#!/usr/bin/env python3
"""
sync_cities.py — Yrow ETL des villes françaises

Récupère les top N communes françaises (par population), enrichies avec :
- Population, coordonnées, département, région (geo.api.gouv.fr)
- Prix m² appartement/maison — DVF, médiane des transactions sur 24 mois
- Loyer m² — Carte des Loyers du ministère du Logement (data.gouv.fr)
- Tension locative — zone tendue officielle + ratio

Puis upsert dans la table Supabase `cities` via REST API.

Sources publiques (aucune clé API requise) :
  - https://geo.api.gouv.fr
  - https://files.data.gouv.fr/geo-dvf/ (transactions immo)
  - https://www.data.gouv.fr/api/1/datasets/carte-des-loyers-.../  (loyers officiels)
  - https://www.data.gouv.fr/api/1/datasets/logement-liste-communes-en-zone-tendue/

Env vars requises :
  SUPABASE_URL                  — ex: https://xxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY     — clé service (NOT anon) depuis Supabase Dashboard

Usage :
  python scripts/sync_cities.py                 # top 1000, upsert prod
  python scripts/sync_cities.py --limit 50      # test rapide sur 50 villes
  python scripts/sync_cities.py --dry-run       # log tout sauf upsert
"""

import argparse
import csv
import gzip
import io
import json
import os
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from typing import Dict, List, Optional, Tuple

# ─── Configuration ─────────────────────────────────────────────────────────

USER_AGENT = "Yrow-ETL/1.0 (+https://yrow.fr; contact quentin.beyens@gmail.com)"
HTTP_TIMEOUT = 60
DVF_YEARS = ["2025", "2024"]  # médiane sur ~24 derniers mois disponibles
DEFAULT_LIMIT = 1000
BATCH_SIZE = 200  # upsert par lots pour éviter les payloads géants

# Codes INSEE des arrondissements (à traiter séparément OU à agréger dans la commune-mère)
# On fera 1 entrée "Paris", "Lyon", "Marseille" (pas d'arrondissements dans Supabase, gérés en front via LYON_QUARTIERS)
COMMUNES_MULTIS = {
    "75056": "Paris",
    "69123": "Lyon",
    "13055": "Marseille",
}
# Codes des arrondissements à SKIPPER dans le top (déjà comptés dans la commune-mère)
ARDT_INSEE = set()
for prefix, count in [("751", 20), ("6938", 9), ("132", 16)]:
    for i in range(1, count + 1):
        ARDT_INSEE.add(f"{prefix}{i:02d}" if len(prefix) == 3 else f"{prefix}{i}")

# ─── HTTP helpers ──────────────────────────────────────────────────────────

def http_get(url: str, accept_gzip: bool = False) -> bytes:
    """GET une URL, retourne les bytes. Décompresse gzip auto si accept_gzip=True."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
        data = resp.read()
    if accept_gzip and url.endswith(".gz"):
        data = gzip.decompress(data)
    return data


def http_get_json(url: str) -> dict:
    return json.loads(http_get(url))


def http_get_csv_reader(url: str) -> Optional[csv.DictReader]:
    """GET un CSV (éventuellement .gz), retourne un DictReader."""
    try:
        raw = http_get(url, accept_gzip=True)
        text = raw.decode("utf-8", errors="replace")
        return csv.DictReader(io.StringIO(text), delimiter=_sniff_delimiter(text))
    except Exception as e:
        print(f"  ⚠️  Erreur GET {url}: {e}", file=sys.stderr)
        return None


def _sniff_delimiter(text: str) -> str:
    """Detecte séparateur CSV (virgule ou point-virgule)."""
    first_line = text.split("\n", 1)[0]
    return ";" if first_line.count(";") > first_line.count(",") else ","


# ─── Discovery des URLs data.gouv.fr (résilience aux changements de version) ─

def find_csv_resource(dataset_slug: str, title_hint: Optional[str] = None) -> Optional[str]:
    """
    Interroge l'API data.gouv.fr pour trouver l'URL du CSV dans un dataset.
    Si title_hint est fourni, priorise les ressources dont le titre le contient.
    """
    url = f"https://www.data.gouv.fr/api/1/datasets/{dataset_slug}/"
    try:
        data = http_get_json(url)
    except Exception as e:
        print(f"  ⚠️  Dataset {dataset_slug} : {e}", file=sys.stderr)
        return None

    resources = data.get("resources", [])
    csv_res = [r for r in resources if (r.get("format") or "").lower() in ("csv", "csv.gz")]

    if title_hint:
        hint = title_hint.lower()
        matching = [r for r in csv_res if hint in (r.get("title") or "").lower()]
        if matching:
            return matching[0].get("url")

    return csv_res[0].get("url") if csv_res else None


# ─── Étape 1 : Populations et geo depuis geo.api.gouv.fr ────────────────────

def fetch_top_communes(limit: int) -> List[dict]:
    """
    Récupère toutes les communes de France, filtre les arrondissements
    déjà couverts par leur commune-mère (Paris, Lyon, Marseille),
    trie par population décroissante, retourne le top N.
    """
    print(f"→ Fetch geo.api.gouv.fr : toutes les communes de France…")
    fields = "nom,code,codeDepartement,codeRegion,population,centre,departement,region"
    url = f"https://geo.api.gouv.fr/communes?fields={fields}&format=json&geometry=centre"
    all_communes = http_get_json(url)
    print(f"  ✅ {len(all_communes)} communes reçues")

    # Filtre : garde communes-mères de Paris/Lyon/Marseille, jette arrondissements
    filtered = [c for c in all_communes if c.get("code") not in ARDT_INSEE]

    # Tri par population décroissante
    filtered.sort(key=lambda c: (c.get("population") or 0), reverse=True)
    top = filtered[:limit]
    print(f"  ✅ Top {limit} conservées (min pop = {top[-1].get('population', 0)})")
    return top


# ─── Étape 2 : Loyers officiels (Carte des Loyers) ──────────────────────────

def fetch_loyers_map() -> Dict[str, dict]:
    """
    Récupère la Carte des Loyers officielle (ministère du Logement).
    Retourne un dict {code_insee: {loyer_m2_apt: float, loyer_m2_msn: float}}.
    """
    print("→ Fetch Carte des Loyers officielle…")
    # Le slug change chaque année. On tente les récents.
    candidates = [
        "carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2024",
        "carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2023",
        "carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2022",
    ]

    apt_url = msn_url = None
    for slug in candidates:
        apt_url = find_csv_resource(slug, title_hint="appartement")
        msn_url = find_csv_resource(slug, title_hint="maison")
        if apt_url or msn_url:
            print(f"  ✅ Dataset trouvé : {slug}")
            break

    if not apt_url and not msn_url:
        print("  ⚠️  Aucun dataset Carte des Loyers trouvé, loyers laissés vides")
        return {}

    loyers: Dict[str, dict] = {}

    def parse_loyers(url: str, key: str):
        reader = http_get_csv_reader(url)
        if not reader:
            return
        count = 0
        for row in reader:
            insee = row.get("INSEE_C") or row.get("insee") or row.get("code_insee") or row.get("code")
            if not insee:
                continue
            # Le champ loyer varie selon les millésimes : "loypredm2", "loyer_m2", "loypredm2c"
            loyer = None
            for k in ("loypredm2", "loyer_m2", "loypredm2c", "loyer_ref_m2"):
                if k in row and row[k]:
                    try:
                        loyer = float(str(row[k]).replace(",", "."))
                        break
                    except (ValueError, TypeError):
                        pass
            if loyer and loyer > 0:
                loyers.setdefault(insee, {})[key] = round(loyer, 2)
                count += 1
        print(f"  ✅ {count} loyers {key} chargés")

    if apt_url:
        parse_loyers(apt_url, "loyer_m2_apt")
    if msn_url:
        parse_loyers(msn_url, "loyer_m2_msn")

    return loyers


# ─── Étape 3 : Zones tendues (officielles) ──────────────────────────────────

def fetch_zones_tendues() -> set:
    """Retourne un set des codes INSEE en zone tendue (encadrement + surtaxe)."""
    print("→ Fetch liste zones tendues officielles…")
    url = find_csv_resource("logement-liste-communes-en-zone-tendue")
    if not url:
        print("  ⚠️  Dataset zones tendues non trouvé")
        return set()
    reader = http_get_csv_reader(url)
    if not reader:
        return set()
    zt = set()
    for row in reader:
        insee = row.get("codeInsee") or row.get("code_insee") or row.get("insee") or row.get("code")
        if insee:
            zt.add(str(insee).zfill(5))
    print(f"  ✅ {len(zt)} communes en zone tendue")
    return zt


# ─── Étape 4 : Prix m² depuis DVF (par département, puis médiane par commune) ─

def fetch_dvf_prices(departments: List[str]) -> Dict[str, dict]:
    """
    Télécharge DVF par département (CSV.gz), extrait toutes les transactions
    Appt / Maison, calcule la médiane du prix au m² par commune sur DVF_YEARS.
    Retourne {code_insee: {prix_m2_apt: float, prix_m2_msn: float}}.
    """
    print(f"→ Fetch DVF pour {len(departments)} département(s) sur {DVF_YEARS}…")
    prices: Dict[str, dict] = {}
    # Accumule les prix par commune par type
    buckets: Dict[Tuple[str, str], List[float]] = {}

    for i, dept in enumerate(departments):
        dept3 = dept.zfill(2) if len(dept) <= 2 else dept
        for year in DVF_YEARS:
            url = f"https://files.data.gouv.fr/geo-dvf/latest/csv/{year}/departements/{dept3}.csv.gz"
            print(f"  [{i+1}/{len(departments)}] Dept {dept3} — {year}", end="", flush=True)
            try:
                raw = http_get(url, accept_gzip=True)
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    print(f"  ⚠️  404 (pas de données)")
                    continue
                print(f"  ⚠️  {e}")
                continue
            except Exception as e:
                print(f"  ⚠️  {e}")
                continue

            text = raw.decode("utf-8", errors="replace")
            reader = csv.DictReader(io.StringIO(text))
            n_rows = 0
            for row in reader:
                n_rows += 1
                if row.get("nature_mutation") != "Vente":
                    continue
                type_local = row.get("type_local", "")
                if type_local not in ("Appartement", "Maison"):
                    continue
                try:
                    valeur = float(row.get("valeur_fonciere") or 0)
                    surface = float(row.get("surface_reelle_bati") or 0)
                except (ValueError, TypeError):
                    continue
                if surface < 9 or valeur < 10000 or valeur > 5_000_000:
                    continue
                prix_m2 = valeur / surface
                if prix_m2 < 200 or prix_m2 > 30000:  # aberrations
                    continue
                insee = row.get("code_commune")
                if not insee:
                    continue
                key = "apt" if type_local == "Appartement" else "msn"
                buckets.setdefault((insee, key), []).append(prix_m2)
            print(f"  ✅ {n_rows:>7} lignes")

    # Agrège les commune-mères (Paris/Lyon/Marseille) depuis leurs arrondissements
    for meta_insee, meta_name in COMMUNES_MULTIS.items():
        for key in ("apt", "msn"):
            all_arr = []
            for ardt_insee in ARDT_INSEE:
                # On ne veut agréger QUE les arrondissements de la commune correspondante
                if meta_insee.startswith("75") and ardt_insee.startswith("751"):
                    all_arr.extend(buckets.get((ardt_insee, key), []))
                elif meta_insee.startswith("69") and ardt_insee.startswith("6938"):
                    all_arr.extend(buckets.get((ardt_insee, key), []))
                elif meta_insee.startswith("13") and ardt_insee.startswith("132"):
                    all_arr.extend(buckets.get((ardt_insee, key), []))
            if all_arr:
                buckets.setdefault((meta_insee, key), []).extend(all_arr)

    # Calcule médianes
    for (insee, key), vals in buckets.items():
        if len(vals) < 3:  # trop peu de transactions = pas fiable
            continue
        median = statistics.median(vals)
        field = "prix_m2_apt" if key == "apt" else "prix_m2_msn"
        prices.setdefault(insee, {})[field] = round(median, 2)

    print(f"  ✅ Médianes calculées pour {len(prices)} communes")
    return prices


# ─── Étape 5 : Fusion et calcul scores ──────────────────────────────────────

def compute_tension(insee: str, in_zone_tendue: bool, pop: int) -> float:
    """
    Score de tension locative 0-10.
    Base : 5. +3 si zone tendue. +1 si pop > 50k, +1 si pop > 200k.
    """
    score = 5.0
    if in_zone_tendue:
        score += 3.0
    if pop > 50_000:
        score += 1.0
    if pop > 200_000:
        score += 1.0
    return min(10.0, round(score, 1))


def compute_attractivite(pop: int, in_zone_tendue: bool) -> float:
    """
    Score d'attractivité 0-10. V1 simple, à raffiner en V2 avec salaire + croissance pop.
    """
    score = 4.0
    if in_zone_tendue:
        score += 2.0
    if pop > 30_000:
        score += 1.0
    if pop > 100_000:
        score += 1.5
    if pop > 500_000:
        score += 1.5
    return min(10.0, round(score, 1))


def build_city_records(
    communes: List[dict],
    loyers: Dict[str, dict],
    prices: Dict[str, dict],
    zt: set,
) -> List[dict]:
    """Assemble les rows finales prêtes à upsert."""
    today = date.today().isoformat()
    records = []

    for c in communes:
        insee = c["code"]
        pop = c.get("population") or 0
        in_zt = insee in zt

        # IMPORTANT : PostgREST exige que tous les objets d'un batch upsert aient
        # exactement les MÊMES clés (PGRST102 "All object keys must match" sinon).
        # Donc on force toutes les colonnes optionnelles à None si data manquante,
        # plutôt que d'omettre la clé.
        centre = c.get("centre") or {}
        coords = centre.get("coordinates") or []
        px = prices.get(insee, {})
        ly = loyers.get(insee, {})

        rec = {
            "nom": c["nom"],
            "code_insee": insee,
            "departement": (c.get("departement") or {}).get("nom") or "",
            "dept_code": c.get("codeDepartement") or "",
            "region": (c.get("region") or {}).get("nom") or "",
            "lat": coords[1] if len(coords) == 2 else None,
            "lon": coords[0] if len(coords) == 2 else None,
            "pop_2022": pop,
            "prix_m2_apt": px.get("prix_m2_apt"),
            "prix_m2_msn": px.get("prix_m2_msn"),
            "loyer_m2_apt": ly.get("loyer_m2_apt"),
            "loyer_m2_msn": ly.get("loyer_m2_msn"),
            "salaire_median": 2100,  # placeholder V1 (moyenne nationale approximative)
            "age_median": 40,
            "tension_loc": compute_tension(insee, in_zt, pop),
            "attractivite": compute_attractivite(pop, in_zt),
            "source_prix": "DVF",
            "source_loyer": "Carte des Loyers 2023 (Ministère)",
            "derniere_maj": today,
            "actif": True,
        }

        records.append(rec)

    return records


# ─── Étape 6 : Upsert vers Supabase ────────────────────────────────────────

def upsert_supabase(records: List[dict], dry_run: bool = False) -> None:
    """
    Upsert (INSERT ... ON CONFLICT DO UPDATE) sur `cities` via REST API Supabase,
    par lots de BATCH_SIZE pour éviter les payloads de 5+ MB.
    Nécessite une contrainte UNIQUE sur code_insee (à créer via migration si absente).
    """
    if dry_run:
        print(f"→ DRY RUN — aurait upsert {len(records)} records")
        print(f"  Exemple record #1 :")
        print("  " + json.dumps(records[0], indent=2, ensure_ascii=False))
        return

    # Nettoyage stricte : supprime whitespace ET tout caractère non-ASCII printable.
    # urllib exige des headers Latin-1 stricts (RFC 7230). Si le secret contient
    # un espace insécable, tab, CR/LF, ou caractère UTF-8 exotique (copy-paste
    # depuis un dashboard qui rend en HTML), le header Authorization est rejeté.
    def _clean(s: str) -> str:
        s = s.strip()
        # Ne garde que les caractères ASCII printables (codes 33-126) + rien d'autre
        return "".join(c for c in s if 33 <= ord(c) <= 126)

    supa_url = _clean(os.environ.get("SUPABASE_URL", "")).rstrip("/")
    supa_key = _clean(os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""))
    if not supa_url or not supa_key:
        print("❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis", file=sys.stderr)
        sys.exit(1)

    # Debug non-sensible : longueur et signature de la clé pour diagnose future
    print(f"  🔑 URL length={len(supa_url)}, key length={len(supa_key)}, "
          f"key starts with '{supa_key[:12]}...'", flush=True)

    endpoint = f"{supa_url}/rest/v1/cities?on_conflict=code_insee"
    # Encode explicitement chaque header en Latin-1 pour repérer un pb en amont
    try:
        auth_header = f"Bearer {supa_key}".encode("latin-1")
        apikey_header = supa_key.encode("latin-1")
    except UnicodeEncodeError as e:
        print(f"❌ Clé Supabase contient un caractère non-Latin-1 : {e}", file=sys.stderr)
        sys.exit(1)

    # On bascule sur http.client bas-niveau + control complet des headers (byte-safe).
    import http.client
    from urllib.parse import urlparse
    parsed = urlparse(endpoint)
    host = parsed.hostname
    path = parsed.path + ("?" + parsed.query if parsed.query else "")

    def _post_batch(batch_body: bytes) -> Tuple[int, str]:
        conn = http.client.HTTPSConnection(host, timeout=HTTP_TIMEOUT)
        try:
            conn.request(
                "POST",
                path,
                body=batch_body,
                headers={
                    "apikey": apikey_header.decode("latin-1"),
                    "Authorization": auth_header.decode("latin-1"),
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates,return=minimal",
                    "Host": host,
                },
            )
            resp = conn.getresponse()
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, body
        finally:
            conn.close()

    total_ok = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        body = json.dumps(batch, ensure_ascii=False).encode("utf-8")
        try:
            status, resp_body = _post_batch(body)
            if 200 <= status < 300:
                total_ok += len(batch)
                print(f"  ✅ Batch {i//BATCH_SIZE + 1}: {len(batch)} rows (HTTP {status})")
            else:
                print(f"  ❌ Batch {i//BATCH_SIZE + 1} — HTTP {status}: {resp_body[:500]}", file=sys.stderr)
        except Exception as e:
            print(f"  ❌ Batch {i//BATCH_SIZE + 1} — {type(e).__name__}: {e}", file=sys.stderr)
        time.sleep(0.3)  # gentle avec Supabase

    print(f"→ Total upsert : {total_ok}/{len(records)}")


# ─── Main ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help=f"Top N communes (défaut {DEFAULT_LIMIT})")
    parser.add_argument("--dry-run", action="store_true", help="Log sans upsert Supabase")
    parser.add_argument("--sample-dept", type=str, default=None,
                        help="Ne traite QUE ce département pour DVF (test rapide, ex: --sample-dept 69)")
    args = parser.parse_args()

    start = time.time()
    print(f"\n╔══ Yrow city ETL — limit={args.limit} dry_run={args.dry_run} ══╗\n")

    # 1. Top N communes
    communes = fetch_top_communes(args.limit)

    # 2. Loyers officiels (une seule requête pour toute la France)
    loyers = fetch_loyers_map()

    # 3. Zones tendues
    zt = fetch_zones_tendues()

    # 4. DVF par département — on ne fetch que les départements représentés dans le top
    departments = sorted({c.get("codeDepartement", "") for c in communes if c.get("codeDepartement")})
    if args.sample_dept:
        departments = [d for d in departments if d == args.sample_dept]
        print(f"→ Sample dept only: {departments}")
    prices = fetch_dvf_prices(departments)

    # 5. Fusion
    records = build_city_records(communes, loyers, prices, zt)
    with_price = sum(1 for r in records if r.get("prix_m2_apt"))
    with_loyer = sum(1 for r in records if r.get("loyer_m2_apt"))
    print(f"\n╔══ Bilan enrichissement ══╗")
    print(f"  Communes traitées      : {len(records)}")
    print(f"  Avec prix m² apt (DVF) : {with_price} ({100*with_price/len(records):.0f}%)")
    print(f"  Avec loyer m² apt      : {with_loyer} ({100*with_loyer/len(records):.0f}%)")

    # 6. Upsert
    upsert_supabase(records, dry_run=args.dry_run)

    print(f"\n╔══ Terminé en {time.time()-start:.1f}s ══╗\n")


if __name__ == "__main__":
    main()
