#!/usr/bin/env python3
"""Generate 0016_opening_ingresos.sql from V8 Ingresos / Egresos / Chase (today)."""
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

D = lambda x: Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

CORTE = "2026-08-19"
CHASE = D("9361.05")
JEAMS = D("52447.33")
PROGRAMADA = {"PX-72775", "PX-72868"}

# carga -> (pid, sku, product, estado, ship, due)
CARGAS = {
    "1361": ("P-02", "JACK", "Jack Fruit", "Cerrada", "2025-12-19", "2026-01-09"),
    "1364": ("P-03", "JACK", "Jack Fruit", "Cerrada", "2025-12-24", "2026-01-14"),
    "1367": ("P-04", "JACK", "Jack Fruit", "Cerrada", "2026-01-08", "2026-01-29"),
    "1370": ("P-07", "JACK", "Jack Fruit", "Cerrada", "2026-01-14", "2026-02-04"),
    "1375": ("P-08", "JACK", "Jack Fruit", "Cerrada", "2026-02-02", "2026-02-23"),
    "1379": ("P-09", "JACK", "Jack Fruit", "Cerrada", "2026-02-16", "2026-03-09"),
    "NGM236396": ("P-010", "PAPA-MARA", "Papaya", "Cerrada", "2026-02-20", "2026-03-13"),
    "1395": ("P-011", "JACK", "Jack Fruit", "Cerrada", "2026-02-24", "2026-03-17"),
    "NGM237088": ("P-012", "PAPA-MARA", "Papaya", "Cerrada", "2026-02-28", "2026-03-21"),
    "1386": ("P-014", "JACK", "Jack Fruit", "Cerrada", "2026-03-03", "2026-03-24"),
    "NGM237688": ("P-015", "PAPA-MARA", "Papaya", "Cerrada", "2026-03-09", "2026-03-30"),
    "1387": ("P-016", "JACK", "Jack Fruit", "Cerrada", "2026-03-11", "2026-04-01"),
    "NGM238314": ("P-017", "PAPA-MARA", "Papaya", "Cerrada", "2026-03-18", "2026-04-08"),
    "1394": ("P-018", "JACK", "Jack Fruit", "Cerrada", "2026-03-18", "2026-04-08"),
    "1401": ("P-020", "JACK", "Jack Fruit", "Cerrada", "2026-03-25", "2026-04-15"),
    "2381": ("P-022", "PAPA-MARA", "Papaya", "Cerrada", "2026-03-30", "2026-04-20"),
    "1409": ("P-023", "JACK", "Jack Fruit", "Cerrada", "2026-04-02", "2026-04-23"),
    "1413": ("P-024", "JACK", "Jack Fruit", "Cerrada", "2026-04-07", "2026-04-28"),
    "FMU01": ("P-025", "JACK", "Jack Fruit", "Cerrada", "2026-04-08", "2026-04-29"),
    "FMU02": ("P-026", "JACK", "Jack Fruit", "Cerrada", "2026-04-10", "2026-05-01"),
    "1416": ("P-027", "JACK", "Jack Fruit", "Cerrada", "2026-04-14", "2026-05-05"),
    "1421": ("P-028", "JACK", "Jack Fruit", "Cerrada", "2026-04-20", "2026-05-12"),
    "1428": ("P-029", "JACK", "Jack Fruit", "Cerrada", "2026-04-28", "2026-05-19"),
    "1438": ("P-030", "JACK", "Jack Fruit", "Cerrada", "2026-05-04", "2026-05-26"),
    "1444": ("P-031", "JACK", "Jack Fruit", "Cerrada", "2026-05-11", "2026-06-01"),
    "NGM242574": ("P-032", "PAPA-MARA", "Papaya", "Cerrada", "2026-05-18", "2026-06-08"),
    "1449": ("P-033", "JACK", "Jack Fruit", "Cerrada", "2026-05-19", "2026-06-09"),
    "1454": ("P-039", "JACK", "Jack Fruit", "Cerrada", "2026-05-26", "2026-06-16"),
    "1459": ("P-043", "JACK", "Jack Fruit", "Cerrada", "2026-06-02", "2026-06-23"),
    "P00128": ("P-044", "PAPA-MARA", "Papaya", "Cerrada", "2026-06-02", "2026-06-23"),
    "1481": ("P-049", "JACK", "Jack Fruit", "Cerrada", "2026-06-10", "2026-07-21"),
    "P00130": ("P-053", "JACK", "Jack Fruit", "Cerrada", "2026-06-17", "2026-07-09"),
    "1470": ("P-054", "JACK", "Jack Fruit", "Cerrada", "2026-06-17", "2026-07-08"),
    "1475": ("P-059", "JACK", "Jack Fruit", "Cerrada", "2026-06-24", "2026-07-17"),
    "24": ("P-060", "COCVER", "Coco verde", "Cerrada", "2026-06-24", "2026-07-17"),
    "1465": ("P-063", "JACK", "Jack Fruit", "Cerrada", "2026-06-30", "2026-07-28"),
    "1001": ("P-065", "KABO", "Kabocha", "Consignacion", "2026-07-06", "2026-07-27"),
    "1495": ("P-067", "JACK", "Jack Fruit", "Cerrada", "2026-07-07", "2026-07-29"),
    "PX-72329": ("P-068", "ESPORG", "Esparrago Organico", "Cerrada", "2026-07-08", "2026-07-29"),
    "1002": ("P-069", "KABO", "Kabocha", "Consignacion", "2026-07-09", "2026-07-30"),
    "1491": ("P-072", "JACK", "Jack Fruit", "Cerrada", "2026-07-13", "2026-08-05"),
    "AX0012": ("P-073", "COLDEBRU", "Col de bruselas", "Cerrada", "2026-07-14", "2026-08-04"),
    "PX-72494": ("P-074", "ESPORG", "Esparrago Organico", "Cerrada", "2026-07-15", "2026-08-05"),
    "36521": ("P-076", "REDHAB", "Habanero Rojo", "Cerrada", "2026-07-22", "2026-08-12"),
    "1505": ("P-077", "JACK", "Jack Fruit", "Cerrada", "2026-07-22", "2026-08-12"),
    "NGM247514": ("P-078", "PAPA-MARA", "Papaya", "Cerrada", "2026-07-24", "2026-08-14"),
    "AX0013": ("P-079", "COLDEBRU", "Col de bruselas", "Cerrada", "2026-07-24", "2026-08-14"),
    "PX-72589": ("P-080", "ESPORG", "Esparrago Organico", "Cerrada", "2026-07-24", "2026-08-14"),
    "AX0014": ("P-081", "COLDEBRU", "Col de bruselas", "Cerrada", "2026-07-24", "2026-08-14"),
    "AX0015": ("P-082", "COLDEBRU", "Col de bruselas", "Cerrada", "2026-07-24", "2026-08-14"),
    "PX-72648": ("P-083", "ESPORG", "Esparrago Organico", "Cerrada", "2026-07-25", "2026-08-15"),
    "36522": ("P-084", "REDHAB", "Habanero Rojo", "Cerrada", "2026-07-29", "2026-08-19"),
    "PX-72650": ("P-085", "ESPORG", "Esparrago Organico", "Cerrada", "2026-07-30", "2026-08-20"),
    "1520": ("P-086", "JACK", "Jack Fruit", "Cerrada", "2026-08-04", "2026-08-25"),
    "PX-72306": ("P-087", "COLDEBRU", "Col de bruselas", "Cerrada", "2026-08-06", "2026-08-27"),
    "PX-72715": ("P-088", "ESPORG", "Esparrago Organico", "Cerrada", "2026-08-06", "2026-08-27"),
    "NGM248545": ("P-089", "PAPA-MARA", "Papaya", "Rechazo", "2026-08-06", "2026-08-27"),
    "36223": ("P-090", "ORAHAB", "Habanero Naranja", "Entregada", "2026-08-07", "2026-08-28"),
    "PX-72774": ("P-091", "ESPORG", "Esparrago Organico", "En Camino", "2026-08-12", "2026-09-02"),
    "1525": ("P-092", "JACK", "Jack Fruit", "En Camino", "2026-08-12", "2026-09-02"),
    "1492": ("P-1492", "JACK", "Jack Fruit", "Cerrada", "2026-07-22", "2026-08-12"),
}

CUST = {
    "Papayas & More, LLC": "CLI-014",
    "Crystal Valley Foods": "CLI-006",
    "Cri International, Inc.": "CLI-004",
    "Northgate Markets": "CLI-013",
    "Freshmexusa, LLC.": "CLI-011",
    "Royal Halo LLC": "CLI-016",
    "Alpine Fresh": "CLI-001",
    "Carrifoods USA Corp.": "CLI-003",
}

VEND = {
    "Papayas & More, LLC": "PRO-024",
    "Las Brisas Produce": "PRO-021",
    "Pampa Store": "PRO-023",
    "Carrifoods USA Corp.": "PRO-013",
    "Luis Alvarez": "PRO-022",
    "Succar Farms": "PRO-030",
    "Agricola Omega S de RL": "PRO-003",
    "Agricola Omega": "PRO-003",
}

# Ingresos: carga, customer, venta, paid, folios (allocation from Ingresos, not Chase comments)
# Overrides applied: en camino IN, rechazo IN, PX-72715 pnp folio 420, PX-72494 closed, Programada OUT.
AR = [
    ("1367", "Papayas & More, LLC", 23540.90, 13961.40, "128"),
    ("1370", "Papayas & More, LLC", 17498.90, 10000.00, "317"),
    ("1375", "Papayas & More, LLC", 16975.70, 10000.00, "329"),
    ("1379", "Papayas & More, LLC", 15852.00, 10000.00, "347"),
    ("1395", "Papayas & More, LLC", 17498.00, 10000.00, "377"),
    ("1386", "Papayas & More, LLC", 18430.40, 10000.00, "417"),
    ("1387", "Papayas & More, LLC", 17243.10, 0, ""),
    ("1394", "Papayas & More, LLC", 18519.80, 0, ""),
    ("1401", "Papayas & More, LLC", 16977.30, 0, ""),
    ("1409", "Papayas & More, LLC", 18493.80, 0, ""),
    ("1449", "Papayas & More, LLC", 15532.00, 0, ""),
    ("1413", "Papayas & More, LLC", 17681.50, 0, ""),
    ("1416", "Papayas & More, LLC", 17978.40, 0, ""),
    ("1421", "Papayas & More, LLC", 17398.85, 0, ""),
    ("1428", "Papayas & More, LLC", 18352.18, 0, ""),
    ("1438", "Papayas & More, LLC", 19177.74, 0, ""),
    ("1444", "Papayas & More, LLC", 17502.00, 0, ""),
    ("1454", "Papayas & More, LLC", 15012.78, 0, ""),
    ("1459", "Papayas & More, LLC", 20483.28, 0, ""),
    ("1465", "Papayas & More, LLC", 16629.98, 0, ""),
    ("1470", "Papayas & More, LLC", 20473.00, 0, ""),
    ("1475", "Papayas & More, LLC", 15139.20, 0, ""),
    ("1481", "Papayas & More, LLC", 14138.29, 0, ""),
    ("1495", "Papayas & More, LLC", 15254.73, 0, ""),
    ("1491", "Papayas & More, LLC", 15320.94, 0, ""),
    ("1505", "Papayas & More, LLC", 16062.70, 0, ""),
    ("1520", "Papayas & More, LLC", 18443.08, 0, ""),
    ("1525", "Papayas & More, LLC", 16500.00, 0, ""),
    ("FMU01", "Freshmexusa, LLC.", 20608.90, 10000.00, "229"),
    ("FMU02", "Freshmexusa, LLC.", 19715.60, 11000.00, "243,393"),
    ("P00128", "Royal Halo LLC", 8870.40, 0, ""),
    ("P00130", "Royal Halo LLC", 8870.40, 0, ""),
    ("24", "Carrifoods USA Corp.", 450.00, 0, ""),
    ("AX0012", "Alpine Fresh", 465.30, 420.30, "411"),
    ("AX0013", "Alpine Fresh", 500.00, 0, ""),
    ("AX0014", "Alpine Fresh", 720.60, 0, ""),
    ("AX0015", "Alpine Fresh", 808.38, 0, ""),
    ("PX-72648", "Crystal Valley Foods", 12960.00, 3600.00, "387"),
    ("PX-72650", "Crystal Valley Foods", 34560.00, 9600.00, "399"),
    ("PX-72589", "Crystal Valley Foods", 21600.00, 6000.00, "387"),
    ("PX-72306", "Crystal Valley Foods", 12690.00, 0, ""),
    ("PX-72715", "Crystal Valley Foods", 34560.00, 9600.00, "420"),
    ("PX-72774", "Crystal Valley Foods", 34560.00, 0, ""),
    ("NGM247514", "Northgate Markets", 23232.00, 0, ""),
    ("NGM248545", "Northgate Markets", 22176.00, 0, ""),
    ("36521", "Cri International, Inc.", 6088.00, 0, ""),
    ("36522", "Cri International, Inc.", 3456.00, 0, ""),
    ("1001", "Cri International, Inc.", 21000.00, 8000.00, "372"),
    ("1002", "Cri International, Inc.", 12900.00, 0, ""),
    ("36223", "Cri International, Inc.", 8136.00, 1842.00, "416"),
]

# Egresos: carga, vendor, total (gasto), paid (pago), concept, folios
# Programada out. NGM248545 merch open; Costa Tropical covered expenses stay paid (not billed).
# 1492 included (in Egresos, not Cargas remaining). En camino included.
AP = [
    ("1361", "Papayas & More, LLC", 22759.73, 6259.73, "Materia prima", "103,104,106"),
    ("1364", "Papayas & More, LLC", 21271.01, 6476.57, "Materia prima", "106"),
    ("1367", "Papayas & More, LLC", 22032.05, 672.00, "Materia prima", "125"),
    ("1370", "Papayas & More, LLC", 17585.60, 0, "Materia prima", ""),
    ("NGM236396", "Papayas & More, LLC", 24816.00, 0, "Materia prima", ""),
    ("NGM237088", "Papayas & More, LLC", 22704.00, 0, "Materia prima", ""),
    ("NGM237688", "Papayas & More, LLC", 22704.00, 0, "Materia prima", ""),
    ("NGM238314", "Papayas & More, LLC", 20592.00, 0, "Materia prima", ""),
    ("NGM242574", "Papayas & More, LLC", 18966.00, 0, "Materia prima", ""),
    ("2381", "Papayas & More, LLC", 19000.00, 0, "Materia prima", ""),
    ("P00128", "Papayas & More, LLC", 7850.00, 0, "Materia prima", ""),
    ("P00130", "Papayas & More, LLC", 7850.00, 0, "Materia prima", ""),
    ("NGM247514", "Papayas & More, LLC", 22704.00, 0, "Materia prima", ""),
    ("NGM248545", "Papayas & More, LLC", 19698.00, 0, "Materia prima", ""),
    ("FMU01", "Papayas & More, LLC", 1094.40, 672.00, "Carton", "123"),
    ("1375", "Papayas & More, LLC", 6657.38, 0, "Comision", ""),
    ("1379", "Papayas & More, LLC", 6066.50, 0, "Comision", ""),
    ("1395", "Papayas & More, LLC", 6354.04, 0, "Comision", ""),
    ("1386", "Papayas & More, LLC", 6871.81, 0, "Comision", ""),
    ("1387", "Papayas & More, LLC", 6678.68, 0, "Comision", ""),
    ("1394", "Papayas & More, LLC", 7182.92, 0, "Comision", ""),
    ("1401", "Papayas & More, LLC", 6324.96, 0, "Comision", ""),
    ("1409", "Papayas & More, LLC", 6650.64, 0, "Comision", ""),
    ("1413", "Papayas & More, LLC", 6516.44, 0, "Comision", ""),
    ("1416", "Papayas & More, LLC", 6666.23, 0, "Comision", ""),
    ("1421", "Papayas & More, LLC", 5621.21, 0, "Comision", ""),
    ("1428", "Papayas & More, LLC", 6111.97, 0, "Comision", ""),
    ("1438", "Papayas & More, LLC", 6433.24, 0, "Comision", ""),
    ("1444", "Papayas & More, LLC", 5655.18, 0, "Comision", ""),
    ("1449", "Papayas & More, LLC", 5754.96, 0, "Comision", ""),
    ("1454", "Papayas & More, LLC", 5277.79, 0, "Comision", ""),
    ("1459", "Papayas & More, LLC", 6499.68, 0, "Comision", ""),
    ("1470", "Papayas & More, LLC", 7597.43, 0, "Comision", ""),
    ("1475", "Papayas & More, LLC", 6023.10, 0, "Comision", ""),
    ("1481", "Papayas & More, LLC", 5448.35, 0, "Comision", ""),
    ("1465", "Papayas & More, LLC", 6737.45, 0, "Comision", ""),
    ("1495", "Papayas & More, LLC", 6017.75, 0, "Comision", ""),
    ("1491", "Papayas & More, LLC", 5763.70, 0, "Comision", ""),
    ("1492", "Papayas & More, LLC", 5427.40, 0, "Comision", ""),
    ("1505", "Papayas & More, LLC", 1904.81, 0, "Comision", ""),
    ("1520", "Papayas & More, LLC", 6578.91, 0, "Comision", ""),
    ("1525", "Papayas & More, LLC", 5427.50, 0, "Comision", ""),
    ("1470", "Las Brisas Produce", 11207.15, 5728.62, "Materia prima", "312,355"),
    ("1495", "Las Brisas Produce", 8646.63, 160.00, "Materia prima", "135"),
    ("1505", "Las Brisas Produce", 14175.48, 0, "Materia prima", ""),
    ("1525", "Las Brisas Produce", 10969.15, 0, "Materia prima", ""),
    ("PX-72329", "Pampa Store", 42000.00, 24000.00, "Materia prima", "315,337,374,390"),
    ("PX-72589", "Pampa Store", 21000.00, 11375.00, "Materia prima", "374,410"),
    ("PX-72715", "Pampa Store", 33600.00, 9600.00, "Materia prima", "400"),
    ("PX-72774", "Pampa Store", 33840.00, 0, "Materia prima", ""),
    ("PX-72494", "Succar Farms", 120.00, 0, "Comision", ""),
    ("PX-72648", "Succar Farms", 90.00, 0, "Comision", ""),
    ("PX-72650", "Succar Farms", 240.00, 0, "Comision", ""),
    ("PX-72589", "Succar Farms", 150.00, 0, "Comision", ""),
    ("PX-72715", "Succar Farms", 240.00, 0, "Comision", ""),
    ("PX-72774", "Succar Farms", 240.00, 0, "Comision", ""),
    ("36522", "Carrifoods USA Corp.", 2352.00, 0, "Materia prima", ""),
    ("36223", "Carrifoods USA Corp.", 5537.00, 0, "Materia prima", ""),
    ("36521", "Luis Alvarez", 533.00, 0, "Comision", ""),
    ("36522", "Luis Alvarez", 552.00, 0, "Comision", ""),
    ("36223", "Luis Alvarez", 1299.50, 0, "Comision", ""),
    ("PX-72306", "Agricola Omega", 12372.75, 0, "Materia prima", ""),
]


def money(x: Decimal) -> str:
    return f"{x:.2f}"


def esc(s: str) -> str:
    return s.replace("'", "''")


def extra_note(carga: str, estado: str) -> str:
    bits = []
    if estado == "En Camino":
        bits.append("En camino — incluida en el corte.")
    if carga == "NGM248545":
        bits.append("Rechazo Northgate. Sigue pendiente, buscando comprador. Gastos Costa Tropical $2,514 ya cubiertos.")
    if carga == "PX-72715":
        bits.append("Folio 420 cobró pick n pack $9,600 de esta carga (el mismo folio cerró PX-72494).")
    if carga == "1386":
        bits.append("Folio 417 aplicado aquí en Ingresos (Chase comentó carga 1520).")
    if carga == "1395":
        bits.append("Folio 377 aplicado aquí en Ingresos (Chase comentó carga 1491).")
    if carga == "1520":
        bits.append("Ingresos sin abono. Chase folio 417 se aplicó a 1386.")
    if carga == "1492":
        bits.append("Está en Egresos, no en el saldo de Cargas.")
    if "Papayas" in (CARGAS.get(carga) or ("", "", "", "", "", ""))[2] or True:
        pass
    return " ".join(bits)


def main() -> None:
    invoices = []
    for carga, customer, total, paid, folios in AR:
        carga = carga.strip()
        if carga in PROGRAMADA:
            continue
        total, paid = D(total), D(paid)
        rem = total - paid
        if rem <= D("0.01") and rem >= D("-0.01"):
            continue
        if rem < 0:
            continue
        meta = CARGAS[carga]
        invoices.append(
            {
                "carga": carga,
                "customer": customer,
                "code": CUST[customer],
                "total": total,
                "paid": paid,
                "rem": rem,
                "folios": folios,
                "pid": meta[0],
                "sku": meta[1],
                "product": meta[2],
                "estado": meta[3],
                "ship": meta[4],
                "due": meta[5],
            }
        )

    # unique bill numbers
    by_carga = defaultdict(list)
    for row in AP:
        by_carga[row[0].strip()].append(row)

    bills = []
    for carga, rows in by_carga.items():
        if carga in PROGRAMADA:
            continue
        open_rows = []
        for carga_, vendor, total, paid, concept, folios in rows:
            total, paid = D(total), D(paid)
            rem = total - paid
            if rem <= D("0.01"):
                continue
            open_rows.append((vendor, total, paid, rem, concept, folios))
        multi = len(open_rows) > 1
        for vendor, total, paid, rem, concept, folios in open_rows:
            vcode = VEND[vendor]
            bill_no = f"{carga}-{vcode.replace('PRO-', '')}" if multi else carga
            meta = CARGAS[carga]
            bills.append(
                {
                    "bill": bill_no,
                    "carga": carga,
                    "vendor": vendor,
                    "code": vcode,
                    "total": total,
                    "paid": paid,
                    "rem": rem,
                    "concept": concept,
                    "folios": folios,
                    "pid": meta[0],
                    "product": meta[2],
                    "estado": meta[3],
                    "ship": meta[4],
                    "due": meta[5],
                }
            )

    ar_total = sum(i["total"] for i in invoices)
    ar_paid = sum(i["paid"] for i in invoices)
    ar_rem = sum(i["rem"] for i in invoices)
    ap_total = sum(b["total"] for b in bills)
    ap_paid = sum(b["paid"] for b in bills)
    ap_rem = sum(b["rem"] for b in bills)
    equity = ar_rem + CHASE - ap_rem - JEAMS

    ap_by_v = defaultdict(lambda: D("0"))
    ar_by_c = defaultdict(lambda: D("0"))
    for i in invoices:
        ar_by_c[i["customer"]] += i["rem"]
    for b in bills:
        ap_by_v[b["vendor"]] += b["rem"]

    print("AR invoices", len(invoices), "total", ar_total, "paid", ar_paid, "rem", ar_rem)
    print("AP bills", len(bills), "total", ap_total, "paid", ap_paid, "rem", ap_rem)
    print("Chase", CHASE, "JEAMS", JEAMS, "equity", equity)
    print("AR by customer")
    for k, v in sorted(ar_by_c.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")
    print("AP by vendor")
    for k, v in sorted(ap_by_v.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")

    lines = []
    a = lines.append
    a("-- Opening cutover rebuilt from V8 money books (Ingresos / Egresos / Chase), not Cargas remaining.")
    a(f"-- As of {CORTE}. Programada PX-72775 / PX-72868 out. En camino in. NGM248545 rechazo in (buyer pending).")
    a("-- PX-72715: venta $34,560 paid $9,600 folio 420 pick n pack (same folio closed PX-72494).")
    a("-- Invoices store TOTAL (venta) and PAID (abonos). Bills store TOTAL (gasto) and PAID (pagos).")
    a(f"-- AR remaining {money(ar_rem)} in {len(invoices)} invoices. AP remaining {money(ap_rem)} in {len(bills)} bills.")
    a(f"-- Chase CORTE-CHASE {money(CHASE)}. JEAMS {money(JEAMS)}. Equity plug {money(equity)}.")
    a("-- Papayas is customer and vendor — do not net. Chase history is not replayed.")
    a("-- Folio application follows Ingresos/Egresos, not Chase comments.")
    a("")
    a("delete from invoice_lines where invoice_id in (select id from invoices where invoice_type = 'opening');")
    a("delete from invoices where invoice_type = 'opening';")
    a("delete from supplier_bills;")
    a("delete from cash_movements where folio = 'CORTE-CHASE';")
    a("")
    a("update gl_accounts set")
    a("  name = 'JP Morgan Chase',")
    a("  description = 'Operating account. Opening from V8 Chase as of 19 Aug 2026; Chase lines are not replayed.',")
    a(f"  tracking_start = '{CORTE}',")
    a("  starting_balance = 0")
    a("where number = '16000';")
    a("")
    a("update gl_accounts set")
    a("  starting_balance = 0,")
    a(f"  tracking_start = '{CORTE}',")
    a("  description = 'Cash movements live on 16000 JP Morgan Chase.'")
    a("where number = '14000';")
    a("")
    a("update gl_accounts set")
    a(f"  starting_balance = {money(equity)},")
    a(f"  tracking_start = '{CORTE}',")
    a("  description = 'Equity plug so opening AR + Chase = AP + JEAMS + equity. Not historical retained earnings.'")
    a("where number = '30000';")
    a("")
    a("insert into gl_accounts (number, name, description, statement, kind, subtype, parent_number, tracking_start, starting_balance, sort_order)")
    a("values (")
    a("  '20250',")
    a("  'JEAMS — Jeam Capital',")
    a("  'Loan from José / JEAMS as of V8 Bancos 19 Aug 2026. Liability, not P&L. Pocket (Egresos paid from Jeam Capital) — not Chase aportaciones.',")
    a("  'balance', 'liability', 'Current > Loan', null,")
    a(f"  '{CORTE}', {money(JEAMS)}, 72")
    a(")")
    a("on conflict (number) do update set")
    a("  name = excluded.name,")
    a("  description = excluded.description,")
    a("  tracking_start = excluded.tracking_start,")
    a("  starting_balance = excluded.starting_balance;")
    a("")
    a("update bank_accounts set")
    a("  name = 'Operating',")
    a("  bank_name = 'JP Morgan Chase',")
    a("  last4 = null,")
    a("  opening_balance = 0")
    a("where id = (select min(id) from bank_accounts);")
    a("")
    a("insert into app_settings (key, value) values")
    a(f"  ('corte_as_of', '{CORTE}'),")
    a(f"  ('chase_balance_as_of', '{CORTE}'),")
    a(f"  ('jeams_balance_as_of', '{CORTE}'),")
    a(f"  ('chase_opening', '{money(CHASE)}'),")
    a(f"  ('jeams_opening', '{money(JEAMS)}')")
    a("on conflict (key) do update set value = excluded.value;")
    a("")

    for i in invoices:
        pap = " Papayas is customer and vendor — do not net." if i["customer"] == "Papayas & More, LLC" else ""
        folio = f" · folios Ingresos {i['folios']}" if i["folios"] else ""
        extra = extra_note(i["carga"], i["estado"])
        extra = (" " + extra) if extra else ""
        notes = (
            f"Corte apertura {CORTE} · carga {i['pid']} · {i['product']} · {i['estado']} · "
            f"Ingresos venta {money(i['total'])} · abonos {money(i['paid'])} · saldo {money(i['rem'])}"
            f"{folio}.{extra}{pap}"
        )
        a("insert into invoices (invoice_number, customer_id, status, issue_date, due_date, subtotal, total, paid, notes, invoice_type, sales_rep)")
        a("select")
        a(f"  '{esc(i['carga'])}', c.id, 'open', '{i['ship']}', '{i['due']}', {money(i['total'])}, {money(i['total'])}, {money(i['paid'])},")
        a(f"  '{esc(notes)}', 'opening', null")
        a("from customers c")
        a(f"where c.code = '{i['code']}'")
        a(f"  and not exists (select 1 from invoices where invoice_number = '{esc(i['carga'])}');")
        a("")
        a("insert into invoice_lines (invoice_id, product_id, description, quantity, unit, unit_price, amount)")
        a("select i.id, p.id,")
        a(f"  '{esc(i['product'])} · {esc(i['estado'])} · carga {i['pid']}',")
        a(f"  1, 'lote', {money(i['total'])}, {money(i['total'])}")
        a("from invoices i")
        a(f"join products p on p.sku = '{i['sku']}'")
        a(f"where i.invoice_number = '{esc(i['carga'])}'")
        a("  and not exists (select 1 from invoice_lines l where l.invoice_id = i.id);")
        a("")

    for b in bills:
        pap = " Papayas is customer and vendor — do not net." if b["vendor"] == "Papayas & More, LLC" else ""
        folio = f" · folios Egresos {b['folios']}" if b["folios"] else ""
        extra = extra_note(b["carga"], b["estado"])
        extra = (" " + extra) if extra else ""
        notes = (
            f"Corte apertura {CORTE} · carga {b['pid']} · {b['product']} · {b['estado']} · {b['concept']} · "
            f"Egresos gasto {money(b['total'])} · pagos {money(b['paid'])} · saldo {money(b['rem'])}"
            f"{folio}.{extra}{pap}"
        )
        a("insert into supplier_bills (bill_number, supplier_id, status, issue_date, due_date, ordered_qty, received_qty, total, paid, notes)")
        a("select")
        a(f"  '{esc(b['bill'])}', s.id, 'open', '{b['ship']}', '{b['due']}', 0, 0, {money(b['total'])}, {money(b['paid'])},")
        a(f"  '{esc(notes)}'")
        a("from suppliers s")
        a(f"where s.code = '{b['code']}'")
        a(f"  and not exists (select 1 from supplier_bills where bill_number = '{esc(b['bill'])}');")
        a("")

    a("insert into cash_movements (folio, mov_date, kind, counterparty, amount, notes)")
    a(f"select 'CORTE-CHASE', '{CORTE}', 'ajuste', 'JP Morgan Chase',")
    a(f"  {money(CHASE)},")
    a("  'Opening cash from V8 Chase Bancos as of 19 Aug 2026 (last movement folio 429). Chase history is not replayed.'")
    a("where not exists (select 1 from cash_movements where folio = 'CORTE-CHASE');")
    a("")
    a("select setval('invoices_id_seq', (select coalesce(max(id),1) from invoices));")
    a("select setval('invoice_lines_id_seq', (select coalesce(max(id),1) from invoice_lines));")
    a("select setval('supplier_bills_id_seq', (select coalesce(max(id),1) from supplier_bills));")
    a("select setval('cash_movements_id_seq', (select coalesce(max(id),1) from cash_movements));")
    a("select setval('gl_accounts_id_seq', (select coalesce(max(id),1) from gl_accounts));")
    a("select setval('bank_accounts_id_seq', (select coalesce(max(id),1) from bank_accounts));")
    a("")

    out = Path("/workspace/migrations/0016_opening_ingresos.sql")
    out.write_text("\n".join(lines) + "\n")
    print("wrote", out, "lines", len(lines))
    Path("/workspace/artifacts/opening-0016-summary.txt").write_text(
        f"AR rem {ar_rem} n={len(invoices)} total {ar_total} paid {ar_paid}\n"
        f"AP rem {ap_rem} n={len(bills)} total {ap_total} paid {ap_paid}\n"
        f"Chase {CHASE} JEAMS {JEAMS} equity {equity}\n"
        + "AR\n"
        + "\n".join(f"  {k}\t{v}" for k, v in sorted(ar_by_c.items(), key=lambda x: -x[1]))
        + "\nAP\n"
        + "\n".join(f"  {k}\t{v}" for k, v in sorted(ap_by_v.items(), key=lambda x: -x[1]))
        + "\n"
    )


if __name__ == "__main__":
    main()
