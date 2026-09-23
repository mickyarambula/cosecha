#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Corte de apertura desde el V8 (xlsx), a cualquier fecha.

Reemplaza al `gen-opening-0016.py` escrito a mano: aquel copiaba carga por
carga los saldos del V8 al 19 Ago 2026. Este lee el libro tal cual y calcula
los saldos a la fecha de corte que se le pida:

  · CxC   — hoja Ingresos: ventas con fecha ≤ corte, menos abonos con fecha
            ≤ corte, por carga y cliente.
  · CxP   — hoja Egresos: gastos con fecha ≤ corte, menos pagos con fecha
            ≤ corte, por carga y proveedor.
  · Chase — hoja Chase (el estado de cuenta): la suma de las líneas con
            fecha ≤ corte. Es la verdad de la caja; los registros pueden ir
            atrasados.
  · JEAMS (bolsillo) — lo que Jeam Capital pagó directo por Plein (cuenta
            "Jeam Capital" en Egresos) menos lo aportado a esa cuenta.
  · Financiamiento a productores — Egresos con concepto "Financiamiento"
            (decisión de Miguel, 23 Sep 2026: es dinero prestado o aportado,
            no gasto). Informativo hasta que Miguel lo clasifique.
  · Depósitos de JEAMS en Chase — líneas de Chase de JEAMS (inversión,
            préstamo, back to back, semilla). Informativo, mismo motivo.

Reglas que vienen de corregir el V8, no de inventar:
  · Un pago con fecha POSTERIOR a hoy es error de captura (en enero se
    capturaron "diciembre" varios pagos de Jeam Capital): se cuenta como
    pagado y se lista para corregirlo en el V8.
  · Un "Pago" registrado con proveedor "General" en una carga que tiene un
    solo proveedor abierto se le aplica a ese proveedor.
  · Programada (PX-72775 / PX-72868) queda fuera, como en el corte anterior.

Uso:
  python3 scripts/gen-corte.py <V8.xlsx> <AAAA-MM-DD> [--hoy AAAA-MM-DD] [--validar]

`--validar` corre al 19 Ago 2026 y compara contra el corte vigente (0016):
las diferencias tienen que ser exactamente las correcciones que se le
hicieron al V8 después de ese corte.
"""
import argparse
import datetime
import re
import sys
from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal

import openpyxl

D = lambda x: Decimal(str(x or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
Z = Decimal("0")
CENT = Decimal("0.01")
PROGRAMADA = {"PX-72775", "PX-72868"}
# Miguel, 23 Sep 2026: TODO lo que JEAMS deposita en Chase es préstamo. Desde
# julio es la línea back to back (6.2 %) que fondea los programas con
# productores; lo de enero a junio es préstamo sin costo.
B2B_DESDE = "2026-07-01"
# Quién debe cada pago de Financiamiento (Miguel, 23 Sep 2026, con los archivos
# de los programas): los semilleros y el invernadero son proveedores del
# programa; el deudor es el productor.
DEUDOR = {
    "Akambarhu Hortalizas": "Akambarhu Hortalizas",
    "Santana Agricola": "Santana Agricola",
    "Baja Plants": "Santana Agricola",          # invernadero del programa de brocolini
    "Seed Company Aruba": "Santana Agricola",   # semilla del programa de brocolini
}
# Sierra Seed se reparte por su comentario en Chase (bell pepper → Akambarhu,
# kabocha → Cornejos). Lo que no se pueda asignar se reporta, no se adivina.
CHASE = "JP Morgan Chase"
JEAM_ACCOUNT = "Jeam Capital"


def day(v):
    if isinstance(v, datetime.datetime):
        return v.date().isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    return None


def s(v):
    return str(v).strip() if v is not None else ""


def folio_of(text):
    m = re.search(r"(\d+)", text or "")
    return m.group(1) if m else None


def norm_party(name):
    n = s(name)
    if n.lower().startswith("agricola omega"):
        return "Agricola Omega"
    if n.lower() == "seed company aruba":
        return "Seed Company Aruba"
    return n


# ── Lectura ──────────────────────────────────────────────────────────────
def load(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)

    def rows(name, start):
        return list(wb[name].iter_rows(values_only=True))[start:]

    ing, eg, ch, tr = [], [], [], []
    for i, r in enumerate(rows("Ingresos", 9), start=10):
        r = list(r) + [None] * 20
        if not s(r[1]):
            continue
        ing.append(dict(row=i, tipo=s(r[1]), concepto=s(r[2]), carga=s(r[3]), desc=s(r[4]), venta=D(r[5]),
                        fecha_venta=day(r[6]), compromiso=day(r[7]), abono=D(r[8]), fecha_abono=day(r[9]),
                        cuenta=s(r[10]), cliente=norm_party(r[11])))
    for i, r in enumerate(rows("Egresos", 9), start=10):
        r = list(r) + [None] * 20
        if not s(r[1]):
            continue
        eg.append(dict(row=i, tipo=s(r[1]), concepto=s(r[2]), carga=s(r[3]), desc=s(r[4]), gasto=D(r[5]),
                       fecha_gasto=day(r[6]), compromiso=day(r[7]), pago=D(r[8]), fecha_pago=day(r[9]),
                       cuenta=s(r[10]), proveedor=norm_party(r[11])))
    for i, r in enumerate(rows("Chase", 2), start=3):
        r = list(r) + [None] * 12
        if r[3] is None and r[5] is None and r[6] is None:
            continue
        ch.append(dict(row=i, grupo=s(r[1]), folio=s(r[2]).replace(".0", ""), fecha=day(r[3]), desc=s(r[4]),
                       ingreso=D(r[5]), egreso=D(r[6]), tipo=s(r[7]), comentario=s(r[8])))
    for i, r in enumerate(rows("Traspasos", 9), start=10):
        r = list(r) + [None] * 16
        if not s(r[1]):
            continue
        tr.append(dict(row=i, partida=s(r[1]), desc=s(r[2]), aportacion=D(r[4]), retiro=D(r[5]), fecha=day(r[6]),
                       origen=s(r[7]), destino=s(r[8])))
    cargas = {}
    for r in rows("Cargas", 9):
        r = list(r) + [None] * 30
        if s(r[1]).startswith("P-"):
            cargas[s(r[2])] = dict(id=s(r[1]), producto=s(r[5]), estado=s(r[6]), embarque=day(r[7]), vence=day(r[8]))
    return dict(ingresos=ing, egresos=eg, chase=ch, traspasos=tr, cargas=cargas)


# ── Cálculo ──────────────────────────────────────────────────────────────
def corte(v, cutoff, hoy):
    avisos = []
    le = lambda d: d is not None and d <= cutoff
    futuro = lambda d: d is not None and d > hoy

    # CxC
    venta, abono, cliente, compromiso = defaultdict(Decimal), defaultdict(Decimal), {}, {}
    for r in v["ingresos"]:
        k = r["carga"]
        if not k or k in PROGRAMADA:
            continue
        if r["tipo"] == "Venta" and le(r["fecha_venta"]):
            venta[k] += r["venta"]
            cliente[k] = r["cliente"]
            compromiso[k] = r["compromiso"]
        if r["abono"] and (le(r["fecha_abono"]) or futuro(r["fecha_abono"])):
            if futuro(r["fecha_abono"]):
                avisos.append(f"Ingresos fila {r['row']}: abono de {r['abono']} con fecha futura {r['fecha_abono']} (carga {k}) — se cuenta como cobrado; corrige la fecha en el V8.")
            abono[k] += r["abono"]
    cxc = []
    for k in sorted(venta):
        saldo = venta[k] - abono[k]
        if saldo > CENT:
            cxc.append(dict(carga=k, cliente=cliente[k], venta=venta[k], abonos=abono[k], saldo=saldo,
                            vence=compromiso.get(k), meta=v["cargas"].get(k)))
        elif saldo < -CENT:
            avisos.append(f"CxC: la carga {k} ({cliente[k]}) tiene abonos de más por {-saldo} — no entra al corte; revisa en el V8.")

    # CxP (sin Financiamiento: no es gasto, va aparte)
    gasto, pago, concepto, compromiso_p = defaultdict(Decimal), defaultdict(Decimal), {}, {}
    general = defaultdict(Decimal)
    for r in v["egresos"]:
        if r["concepto"] == "Financiamiento":
            continue
        k = (r["carga"], r["proveedor"])
        if r["carga"] in PROGRAMADA:
            continue
        if r["tipo"] != "Pago" and le(r["fecha_gasto"]):
            gasto[k] += r["gasto"]
            concepto[k] = f"{r['tipo']} · {r['concepto']}"
            compromiso_p[k] = r["compromiso"]
        if r["pago"] and (le(r["fecha_pago"]) or futuro(r["fecha_pago"])):
            if futuro(r["fecha_pago"]):
                avisos.append(f"Egresos fila {r['row']}: pago de {r['pago']} a {r['proveedor']} con fecha futura {r['fecha_pago']} ({r['desc']}, cuenta {r['cuenta']}) — se cuenta como pagado; corrige la fecha en el V8.")
            if r["proveedor"] == "General" and r["carga"]:
                general[r["carga"]] += r["pago"]
            else:
                pago[k] += r["pago"]
    for carga, monto in general.items():
        abiertos = [k for k in gasto if k[0] == carga and gasto[k] - pago[k] > CENT]
        if len(abiertos) == 1:
            pago[abiertos[0]] += monto
            avisos.append(f"Egresos: pago de {monto} con proveedor 'General' en la carga {carga} — aplicado a {abiertos[0][1]}, su único proveedor abierto.")
        else:
            avisos.append(f"Egresos: pago de {monto} con proveedor 'General' en la carga {carga} — {len(abiertos)} proveedores abiertos, NO se aplicó; dime a quién va.")
    cxp = []
    for k in sorted(gasto):
        saldo = gasto[k] - pago[k]
        if saldo > CENT:
            cxp.append(dict(carga=k[0], proveedor=k[1], gasto=gasto[k], pagos=pago[k], saldo=saldo, concepto=concepto[k],
                            vence=compromiso_p.get(k), meta=v["cargas"].get(k[0])))
        elif saldo < -CENT:
            avisos.append(f"CxP: {k[1]} en la carga {k[0] or '(sin carga)'} tiene pagos de más por {-saldo} — no entra al corte; revisa en el V8.")

    # Chase: el estado de cuenta manda
    chase_rows = [r for r in v["chase"] if le(r["fecha"])]
    chase = sum((r["ingreso"] + r["egreso"] for r in chase_rows), Z)
    ultimo = max(chase_rows, key=lambda r: (r["fecha"], r["row"]))["folio"] if chase_rows else None

    # JEAMS bolsillo: lo que Jeam Capital pagó directo por Plein
    jeam = Z
    for r in v["egresos"]:
        if r["cuenta"] == JEAM_ACCOUNT and r["pago"] and (le(r["fecha_pago"]) or futuro(r["fecha_pago"])):
            jeam += r["pago"]
    for r in v["traspasos"]:
        if r["destino"] == JEAM_ACCOUNT and le(r["fecha"]):
            jeam -= r["aportacion"]

    # Financiamiento a productores (activo) y depósitos de JEAMS en Chase (pasivo)
    fin = defaultdict(lambda: dict(monto=Z, renglones=[]))
    chase_por_folio = {x["folio"]: x for x in v["chase"]}
    for r in v["egresos"]:
        c = chase_por_folio.get(folio_of(r["desc"]))
        # En Chase manda el tipo: una salida marcada "Prestamo" a un productor o
        # semillero es financiamiento aunque en Egresos se haya capturado como
        # costo (folio 422, semilla de Cornejos, quedó como "Materia prima").
        es_prestamo = c is not None and c["tipo"] == "Prestamo" and c["egreso"] and "JEAMS" not in c["desc"].upper()
        if r["concepto"] != "Financiamiento" and es_prestamo and r["tipo"] != "Pago" and le(r["fecha_gasto"]):
            avisos.append(f"Egresos fila {r['row']}: {r['gasto']} a {r['proveedor']} ({r['desc']}) está como '{r['tipo']} · {r['concepto']}' pero en Chase es préstamo ('{c['comentario']}') — entra como financiamiento; corrígelo en el V8.")
        elif r["concepto"] != "Financiamiento":
            continue
        if le(r["fecha_gasto"]):
            nota = c["comentario"] if c else ""
            deudor = DEUDOR.get(r["proveedor"])
            if deudor is None and r["proveedor"].lower().startswith("sierra seed"):
                t = nota.lower()
                deudor = "Cornejos Horticola" if ("kabocha" in t or "cornejos" in t) else ("Akambarhu Hortalizas" if ("bell pepper" in t or "akambarhu" in t) else None)
            if deudor is None:
                deudor = f"SIN ASIGNAR ({r['proveedor'] or 'sin nombre'})"
                avisos.append(f"Financiamiento sin deudor claro: {r['gasto']} a {r['proveedor']} el {r['fecha_gasto']} ({r['desc']}, Chase: '{nota}') — dime de qué productor es.")
            f = fin[deudor]
            f["monto"] += r["gasto"]
            f["renglones"].append((r["fecha_gasto"], r["gasto"], r["proveedor"], nota))
    dep = defaultdict(lambda: dict(monto=Z, renglones=[]))
    for r in v["chase"]:
        if "JEAMS" in r["desc"].upper() and r["tipo"] in ("Inversion", "Prestamo") and le(r["fecha"]):
            clase = "Back to back (6.2 %)" if r["fecha"] >= B2B_DESDE else "Préstamo sin costo"
            d = dep[clase]
            d["monto"] += r["ingreso"] + r["egreso"]
            d["renglones"].append((r["fecha"], r["ingreso"] + r["egreso"], r["folio"], r["comentario"]))

    # Lo que está en Chase y todavía no en los registros (después del corte anterior)
    reg_folios = {folio_of(r["desc"]) for r in v["ingresos"] + v["egresos"]}
    pendientes = [r for r in v["chase"] if r["fecha"] and "2026-08-19" < r["fecha"] <= cutoff
                  and (r["ingreso"] + r["egreso"]) != 0 and r["folio"] not in reg_folios
                  and r["tipo"] not in ("Sueldo", "Inversion") and not ("JEAMS" in r["desc"].upper())]

    cxc_t = sum((x["saldo"] for x in cxc), Z)
    cxp_t = sum((x["saldo"] for x in cxp), Z)
    fin_t = sum((f["monto"] for f in fin.values()), Z)
    sin_costo = jeam + dep["Préstamo sin costo"]["monto"] if "Préstamo sin costo" in dep else jeam
    b2b = dep["Back to back (6.2 %)"]["monto"] if "Back to back (6.2 %)" in dep else Z
    return dict(cutoff=cutoff, cxc=cxc, cxp=cxp, cxc_total=cxc_t, cxp_total=cxp_t, chase=chase, ultimo_folio=ultimo,
                jeam=jeam, financiamiento=dict(fin), depositos_jeams=dict(dep), avisos=avisos,
                chase_sin_registro=pendientes, capital=cxc_t + chase - cxp_t - jeam,
                financiamiento_total=fin_t, jeams_sin_costo=sin_costo, jeams_b2b=b2b,
                capital_real=cxc_t + chase + fin_t - cxp_t - sin_costo - b2b)


def money(x):
    return f"{x:,.2f}"


def report(c):
    out = []
    a = out.append
    a(f"CORTE AL {c['cutoff']}")
    a(f"  CxC   {money(c['cxc_total']):>14}  ({len(c['cxc'])} facturas)")
    a(f"  CxP   {money(c['cxp_total']):>14}  ({len(c['cxp'])} facturas)")
    a(f"  Chase {money(c['chase']):>14}  (último folio {c['ultimo_folio']})")
    a(f"  JEAMS {money(c['jeam']):>14}  (lo que Jeam Capital pagó directo por Plein)")
    a(f"  Capital (cuadre) {money(c['capital']):>14}  = CxC + Chase − CxP − JEAMS, antes de financiamiento")
    a("")
    by_c, by_p = defaultdict(Decimal), defaultdict(Decimal)
    for x in c["cxc"]:
        by_c[x["cliente"]] += x["saldo"]
    for x in c["cxp"]:
        by_p[x["proveedor"]] += x["saldo"]
    a("CxC por cliente")
    for k, val in sorted(by_c.items(), key=lambda t: -t[1]):
        a(f"  {k:<36} {money(val):>14}")
    a("CxP por proveedor")
    for k, val in sorted(by_p.items(), key=lambda t: -t[1]):
        a(f"  {k:<36} {money(val):>14}")
    a("")
    a("BALANCE DE APERTURA COMPLETO (con la clasificación de Miguel del 23 Sep 2026)")
    a(f"  Activo  · CxC                              {money(c['cxc_total']):>14}")
    a(f"          · Chase                            {money(c['chase']):>14}")
    a(f"          · Financiamiento a productores     {money(c['financiamiento_total']):>14}  (nada recuperado todavía)")
    a(f"  Pasivo  · CxP                              {money(c['cxp_total']):>14}")
    a(f"          · JEAMS sin costo                  {money(c['jeams_sin_costo']):>14}  (pagos directos de enero + depósitos ene–jun)")
    a(f"          · JEAMS back to back 6.2 %         {money(c['jeams_b2b']):>14}  (depósitos desde julio)")
    a(f"  Capital (cuadre)                           {money(c['capital_real']):>14}")
    a("")
    a("FINANCIAMIENTO A PRODUCTORES, POR DEUDOR")
    for k, f in sorted(c["financiamiento"].items(), key=lambda t: -t[1]["monto"]):
        a(f"  {k:<36} {money(f['monto']):>14}  ({len(f['renglones'])} pagos)")
    a(f"  {'Total':<36} {money(sum((f['monto'] for f in c['financiamiento'].values()), Z)):>14}")
    a("DEPÓSITOS DE JEAMS EN CHASE (todos préstamo)")
    for k, d in sorted(c["depositos_jeams"].items()):
        a(f"  {k:<36} {money(d['monto']):>14}  ({len(d['renglones'])} movimientos)")
    a("")
    if c["chase_sin_registro"]:
        a("EN CHASE PERO TODAVÍA NO EN INGRESOS/EGRESOS (después del 19 Ago)")
        for r in c["chase_sin_registro"]:
            a(f"  folio {r['folio']:>4} {r['fecha']} {money(r['ingreso'] + r['egreso']):>12}  {r['desc'][:30]}  {r['comentario'][:40]}")
        a("")
    if c["avisos"]:
        a("AVISOS DEL V8")
        for x in c["avisos"]:
            a(f"  · {x}")
    return "\n".join(out)


# ── Validación contra el corte vigente (19 Ago 2026) ─────────────────────
CORTE_0016 = dict(cxc=Decimal("673014.43"), cxp=Decimal("570097.56"), chase=Decimal("9361.05"), jeam=Decimal("52447.33"))


def validar(v, hoy):
    c = corte(v, "2026-08-19", hoy)
    print(report(c))
    print("\nVALIDACIÓN CONTRA EL CORTE VIGENTE (0016)")
    for k, label in (("cxc_total", "cxc"), ("cxp_total", "cxp"), ("chase", "chase"), ("jeam", "jeam")):
        got, exp = c[k], CORTE_0016[label]
        print(f"  {label:<6} V8 hoy {money(got):>14}   corte {money(exp):>14}   diferencia {money(got - exp):>12}")
    # Carga por carga contra las listas del generador anterior: cada diferencia
    # tiene que ser una corrección que se le hizo al V8 después del corte.
    import importlib.util, pathlib
    spec = importlib.util.spec_from_file_location("g0016", pathlib.Path(__file__).with_name("gen-opening-0016.py"))
    g = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(g)
    viejo_c = defaultdict(Decimal)
    for carga, _cli, total, paid, _f in g.AR:
        if carga not in PROGRAMADA:
            viejo_c[carga] += D(total) - D(paid)
    nuevo_c = defaultdict(Decimal)
    for x in c["cxc"]:
        nuevo_c[x["carga"]] += x["saldo"]
    viejo_p = defaultdict(Decimal)
    for carga, prov, total, paid, _c, _f in g.AP:
        if carga not in PROGRAMADA:
            viejo_p[(carga, norm_party(prov))] += max(D(total) - D(paid), Z)
    nuevo_p = defaultdict(Decimal)
    for x in c["cxp"]:
        nuevo_p[(x["carga"], x["proveedor"])] += x["saldo"]
    print("\n  Diferencias carga por carga (V8 de hoy − corte vigente):")
    tc = tp = Z
    for k in sorted(set(viejo_c) | set(nuevo_c)):
        d = nuevo_c[k] - viejo_c[k]
        if abs(d) > CENT:
            tc += d
            print(f"    CxC {k:<12} {money(viejo_c[k]):>12} → {money(nuevo_c[k]):>12}   {money(d):>12}")
    for k in sorted(set(viejo_p) | set(nuevo_p)):
        d = nuevo_p[k] - viejo_p[k]
        if abs(d) > CENT:
            tp += d
            print(f"    CxP {k[0] or '(sin carga)':<12} {k[1][:22]:<22} {money(viejo_p[k]):>12} → {money(nuevo_p[k]):>12}   {money(d):>12}")
    print(f"  Suma de diferencias: CxC {money(tc)} · CxP {money(tp)}")
    return c


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx")
    ap.add_argument("fecha", nargs="?")
    ap.add_argument("--hoy", default=datetime.date.today().isoformat())
    ap.add_argument("--validar", action="store_true")
    args = ap.parse_args()
    v = load(args.xlsx)
    if args.validar:
        validar(v, args.hoy)
    else:
        if not args.fecha:
            sys.exit("Falta la fecha de corte (AAAA-MM-DD).")
        print(report(corte(v, args.fecha, args.hoy)))
