"""Generates data/seed_data/*.json — the demo world SAATHI operates on.

Dates are relative (`days_ago`, `*_in_days`) so the demo is evergreen; the
store resolves them to real dates at load time. Run: python data/generate_seed.py
"""
import json
from pathlib import Path

OUT = Path(__file__).parent / "seed_data"
OUT.mkdir(exist_ok=True)


def write(name, rows):
    (OUT / name).write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")


write("users.json", [
    {"user_id": "U001", "name": "Rahul", "phone": "+91-98450-XXXXX", "language": "kn-IN", "role": "consumer", "city": "Bengaluru"},
    {"user_id": "M001", "name": "Lakshmi", "phone": "+91-99000-XXXXX", "language": "kn-IN", "role": "merchant",
     "merchant_id": "MER-001", "city": "Mysuru"},
])

# Rahul's normal spending: ~₹850 average to known recipients.
history = [
    (1, "Swiggy", 560), (2, "BESCOM Electricity", 1450), (3, "Reliance Fresh", 1200), (4, "Uber", 450),
    (6, "Airtel Recharge", 599), (7, "Amma (family)", 1500), (9, "Cafe Coffee Day", 520), (11, "BigBasket", 1180),
    (12, "Namma Metro", 386), (14, "Apollo Pharmacy", 840), (16, "Swiggy", 515), (18, "Reliance Fresh", 1000),
]
write("transactions.json", [
    {"txn_id": f"TXN-{8800 + i}", "user_id": "U001", "amount": amt, "recipient": name, "recipient_id": name.lower().replace(" ", "_"),
     "days_ago": d, "time": "19:20", "channel": "UPI", "status": "COMPLETED", "risk_score": 8, "is_new_recipient": False, "device": "known"}
    for i, (d, name, amt) in enumerate(history)
])

write("financial_data.json", [
    {"user_id": "U001", "savings_balance": 32000, "current_balance": 5200, "monthly_income": 28000, "salary_in_days": 9,
     "insurance_policy": "Star Health Family Floater", "insurance_policy_no": "SH-PL-77812", "insurance_coverage": 60000,
     "insurance_covers": ["hospitalisation", "surgery", "medical emergency"], "monthly_emi": 8000, "emi_in_days": 15,
     "preapproved_loan": 50000, "loan_rate_pct": 11.5, "emergency_buffer": 8000},
])

write("recurring_payments.json", [
    {"rp_id": "RP-01", "user_id": "U001", "name": "Home broadband + OTT bundle (annual)", "amount": 8999, "due_in_days": 6,
     "mandate": "UPI AutoPay", "category": "subscription", "past_failures": 0, "status": "ACTIVE"},
    {"rp_id": "RP-02", "user_id": "U001", "name": "Health insurance premium", "amount": 2450, "due_in_days": 12,
     "mandate": "UPI AutoPay", "category": "insurance", "past_failures": 0, "status": "ACTIVE"},
    {"rp_id": "RP-03", "user_id": "U001", "name": "Two-wheeler EMI", "amount": 8000, "due_in_days": 15,
     "mandate": "NACH", "category": "emi", "past_failures": 0, "status": "ACTIVE"},
])

write("merchants.json", [
    {"merchant_id": "MER-001", "name": "Lakshmi General Stores", "owner_user_id": "M001", "type": "kirana", "role": "self",
     "city": "Mysuru", "language": "kn-IN"},
    {"merchant_id": "VEN-ABC", "name": "ABC Stationers", "role": "vendor", "category": "stationery", "rating": 4.6,
     "distance_km": 1.8, "delivery": "Tomorrow 9 AM", "catalog": {"notebook": {"price": 60, "stock": 200}, "pen": {"price": 42, "stock": 500}}},
    {"merchant_id": "VEN-XYZ", "name": "XYZ Book Depot", "role": "vendor", "category": "stationery", "rating": 4.3,
     "distance_km": 3.2, "delivery": "Tomorrow 5 PM", "catalog": {"notebook": {"price": 65, "stock": 120}, "pen": {"price": 45, "stock": 300}}},
    {"merchant_id": "VEN-PQR", "name": "PQR Office Mart", "role": "vendor", "category": "stationery", "rating": 4.1,
     "distance_km": 5.5, "delivery": "Day after tomorrow", "catalog": {"notebook": {"price": 55, "stock": 12}, "pen": {"price": 40, "stock": 80}}},
])

write("inventory.json", [
    {"sku": "SKU-RICE", "merchant_id": "MER-001", "item": "Sona Masoori Rice", "unit": "KG", "stock": 8, "min_stock": 25,
     "pack_size": 50, "unit_cost": 48, "sell_price": 62, "daily_usage": 6, "lead_days": 2, "supplier_id": "SUP-ABC"},
    {"sku": "SKU-SUGAR", "merchant_id": "MER-001", "item": "Sugar", "unit": "KG", "stock": 42, "min_stock": 20,
     "pack_size": 50, "unit_cost": 40, "sell_price": 48, "daily_usage": 4, "lead_days": 2, "supplier_id": "SUP-ABC"},
    {"sku": "SKU-TOOR", "merchant_id": "MER-001", "item": "Toor Dal", "unit": "KG", "stock": 19, "min_stock": 15,
     "pack_size": 25, "unit_cost": 120, "sell_price": 150, "daily_usage": 2, "lead_days": 2, "supplier_id": "SUP-ABC"},
    {"sku": "SKU-OIL", "merchant_id": "MER-001", "item": "Sunflower Oil", "unit": "L", "stock": 26, "min_stock": 15,
     "pack_size": 15, "unit_cost": 135, "sell_price": 160, "daily_usage": 3, "lead_days": 2, "supplier_id": "SUP-ABC"},
    {"sku": "SKU-TEA", "merchant_id": "MER-001", "item": "Tea Powder", "unit": "KG", "stock": 7, "min_stock": 5,
     "pack_size": 10, "unit_cost": 380, "sell_price": 460, "daily_usage": 0.6, "lead_days": 1, "supplier_id": "SUP-FRESH"},
    {"sku": "SKU-MILK", "merchant_id": "MER-001", "item": "Nandini Milk", "unit": "L", "stock": 40, "min_stock": 30,
     "pack_size": 40, "unit_cost": 44, "sell_price": 50, "daily_usage": 38, "lead_days": 1, "supplier_id": "SUP-FRESH"},
])

# 14 days of sales. Previous week evenings ~₹11,900/day, last 7 days ~₹8,200/day (-31%).
# Today ₹18,400 vs yesterday ₹14,200 (+29.6%) thanks to a morning bulk order.
prev_week_evening = [11800, 12100, 11650, 12000, 11900, 11850, 12000]
last_week_evening = [8250, 8150, 8300, 8100, 8200, 8300, 8200]
prev_customers = [212, 208, 214, 206, 211, 209, 210]
last_customers = [186, 183, 188, 184, 186, 185, 183]
sales = []
for i in range(14):
    days_ago = 13 - i
    if i < 7:
        evening, customers = prev_week_evening[i], prev_customers[i]
        morning, afternoon = 3600 + (i % 3) * 150, 2400 + (i % 2) * 120
    else:
        evening, customers = last_week_evening[i - 7], last_customers[i - 7]
        morning, afternoon = 3500 + (i % 3) * 120, 2350 + (i % 2) * 100
    if days_ago == 1:
        morning, afternoon, evening = 3400, 2500, 8300
    if days_ago == 0:
        morning, afternoon, evening = 6900, 3300, 8200
    sales.append({"sale_id": f"SAL-{100 + i}", "merchant_id": "MER-001", "days_ago": days_ago,
                  "morning": morning, "afternoon": afternoon, "evening": evening,
                  "total": morning + afternoon + evening, "transactions": customers + 40,
                  "regular_customers": customers, "cash_share": 1.0})
write("sales.json", sales)

write("expenses.json", [
    {"expense_id": "EXP-01", "merchant_id": "MER-001", "days_ago": 0, "category": "Staff wages", "amount": 3000, "mode": "cash"},
    {"expense_id": "EXP-02", "merchant_id": "MER-001", "days_ago": 0, "category": "Electricity", "amount": 1800, "mode": "cash"},
    {"expense_id": "EXP-03", "merchant_id": "MER-001", "days_ago": 0, "category": "Transport", "amount": 1200, "mode": "cash"},
    {"expense_id": "EXP-04", "merchant_id": "MER-001", "days_ago": 0, "category": "Packaging & misc", "amount": 1200, "mode": "cash"},
    {"expense_id": "EXP-05", "merchant_id": "MER-001", "days_ago": 1, "category": "Staff wages", "amount": 3000, "mode": "cash"},
    {"expense_id": "EXP-06", "merchant_id": "MER-001", "days_ago": 1, "category": "Transport", "amount": 900, "mode": "cash"},
])

write("customer_credit.json", [
    {"customer_id": "CUS-01", "merchant_id": "MER-001", "name": "Ramesh", "phone": "+91-97400-XXXXX", "outstanding": 4500,
     "overdue_days": 7, "last_purchase_days_ago": 9, "status": "OVERDUE", "reminders_sent": 0},
    {"customer_id": "CUS-02", "merchant_id": "MER-001", "name": "Suresh", "phone": "+91-96320-XXXXX", "outstanding": 2500,
     "overdue_days": 3, "last_purchase_days_ago": 5, "status": "OVERDUE", "reminders_sent": 0},
    {"customer_id": "CUS-03", "merchant_id": "MER-001", "name": "Meena", "phone": "+91-90080-XXXXX", "outstanding": 1500,
     "overdue_days": 0, "last_purchase_days_ago": 2, "status": "CURRENT", "reminders_sent": 0},
])

write("suppliers.json", [
    {"supplier_id": "SUP-ABC", "name": "ABC Stores (Wholesale)", "contact": "Manjunath", "items": ["rice", "sugar", "dal", "oil"],
     "delivery": "Tomorrow", "rating": 4.7, "channel": "telegram"},
    {"supplier_id": "SUP-FRESH", "name": "Fresh Dairy & Tea Co.", "contact": "Farah", "items": ["milk", "tea"],
     "delivery": "Today", "rating": 4.5, "channel": "telegram"},
])

write("cash_reconciliation.json", [
    {"recon_id": "REC-TODAY", "merchant_id": "MER-001", "days_ago": 0, "expected_cash": None, "actual_cash": 10700,
     "variance": None, "reason": "", "approved_by": "", "timestamp": "", "status": "PENDING"},
])

write("campaigns.json", [
    {"campaign_id": "CMP-480", "merchant_id": "MER-001", "name": "Ugadi Festival Basket", "offer": "5% off on 5 KG rice + dal",
     "price": None, "window": "All day", "status": "COMPLETED", "channel": "telegram", "before_daily": 13100, "after_daily": 14600,
     "improvement_pct": 11.5, "simulated": True},
])

for empty in ["orders.json", "fraud_cases.json", "payment_predictions.json", "activity_logs.json", "approvals.json",
              "calls.json", "insurance_claims.json", "payment_plans.json", "outbox.json", "agent_runs.json"]:
    write(empty, [])

print("seed written to", OUT)
