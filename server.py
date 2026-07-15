import numpy as np
import pandas as pd
import joblib
import warnings
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os

# Silence sklearn feature-name warnings
warnings.filterwarnings("ignore", category=UserWarning)

# ── Load trained artifacts ──────────────────────────────────────────
try:
    model      = joblib.load("metro_mlp_model.pkl")
    le_station = joblib.load("le_station.pkl")
    le_dest    = joblib.load("le_dest.pkl")
    ALL_STATIONS = sorted(list(le_station.classes_))
    print("[OK] Model and encoders loaded successfully.")
except Exception as e:
    print(f"[ERROR] Error loading model artifacts: {e}")
    raise SystemExit(1)

# ── Station code → full-name mapping (Bangalore Namma Metro) ────────
STATION_NAMES = {
    "AGPP": "Attiguppe",
    "APRC": "Konanakunte Cross",
    "APTS": "Silk Institute",
    "BGUC": "Jnanabharathi",
    "BIET": "Madavara",
    "BMSD": "Bommasandra",
    "BNSK": "Banashankari",
    "BRCS": "Krantivira Sangolli Rayanna Railway Station",
    "BSRD": "Hosa Road",
    "BTML": "BTM Layout",
    "BYPH": "Baiyappanahalli",
    "CBPK": "Cubbon Park",
    "CHPK": "Chikkapette",
    "CKBR": "Singasandra",
    "CLGT": "Challaghatta",
    "DJNR": "Deepanjalinagar",
    "DKIA": "Hoodi",
    "DSH": "Dasarahalli",
    "ECTN": "Konappana Agrahara",
    "ETCT": "Electronic City",
    "GDCP": "Garudacharapalya",
    "HBGI": "Hebbagodi",
    "HLRU": "Halasuru",
    "HOSR": "Beratena Agrahara",
    "HSKR": "Huskur Road",
    "HSLI": "Hosahalli",
    "HSRL": "Bommanahalli",
    "IDN": "Indiranagar",
    "ITPL": "Pattandur Agrahara",
    "JAYN": "Jayanagar",
    "JDHP": "Jayadeva Hospital",
    "JHLI": "Jalahalli",
    "JIDL": "Chikkabidarakallu",
    "JPN": "Jayaprakash Nagar",
    "JTPM": "Benniganahalli",
    "KDGD": "Kadugodi Tree Park",
    "KDNH": "Kundalahalli",
    "KGIT": "Kengeri",
    "KGWA": "Nadaprabhu Kempegowda Majestic",
    "KLPK": "Doddakallasandra",
    "KRMT": "Krishnarajendra Market",
    "KRPM": "Krishnarajapura",
    "KVPR": "Kuvempu Road",
    "LAGH": "Lalbagh",
    "MDVP": "Singayyanapalya",
    "MGRD": "Mahatma Gandhi Road",
    "MHLI": "Mahalakshmi",
    "MIRD": "Magadi Road",
    "MLSD": "Kengeri Bus Terminal",
    "MNJN": "Manjunath Nagar",
    "MSRN": "Kudlu Gate",
    "MYRD": "Mysuru Road",
    "NGSA": "Nagasandra",
    "NLC": "National College",
    "NYHM": "Nayandahalli",
    "OFDC": "Hongasandra",
    "PATC": "Pattanagere",
    "PEYA": "Peenya",
    "PUTH": "Yelachenahalli",
    "PYID": "Peenya Industry",
    "RGDT": "Ragigudda",
    "RJNR": "Rajajinagar",
    "RRRN": "Rajarajeshwari Nagar",
    "RVRD": "Rashtreeya Vidyalaya Road",
    "SBJT": "Central Silk Board",
    "SECE": "South End Circle",
    "SPGD": "Sampige Road",
    "SPRU": "Srirampura",
    "SSFY": "Sandal Soap Factory",
    "SSHP": "Sri Sathya Sai Hospital",
    "SVRD": "Swami Vivekananda Road",
    "TGTP": "Talaghattapura",
    "TTY": "Trinity",
    "UWVL": "Hopefarm Channasandra",
    "VDHP": "Nallurhalli",
    "VDSA": "Vidhana Soudha",
    "VJNR": "Vijayanagara",
    "VJRH": "Vajarahalli",
    "VSWA": "Sir M. Visveshwaraya",
    "VWIA": "Seetharamapalya",
    "WHTM": "Whitefield",
    "YPI": "Goraguntepalya",
    "YPM": "Yeshwanthpura",
}


# ── Flask app ───────────────────────────────────────────────────────
app = Flask(__name__, static_folder="public", static_url_path="")
CORS(app)


# Serve frontend
@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


# Return station list with full names
@app.route("/api/stations")
def get_stations():
    result = []
    for code in ALL_STATIONS:
        result.append({
            "code": code,
            "name": STATION_NAMES.get(code, code)
        })
    result.sort(key=lambda s: s["name"])
    return jsonify(result)


# Single-point prediction
@app.route("/api/predict", methods=["POST"])
def predict():
    data = request.get_json(force=True)

    origin      = data.get("origin")
    destination = data.get("destination")
    day         = int(data.get("day"))
    frac_time   = float(data.get("time"))

    # Encode station names → integers
    try:
        orig_enc = int(le_station.transform([origin])[0])
        dest_enc = int(le_dest.transform([destination])[0])
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400

    # Cyclical time encoding
    sin_val = np.sin(2 * np.pi * frac_time / 24.0)
    cos_val = np.cos(2 * np.pi * frac_time / 24.0)

    features = pd.DataFrame([{
        "STATION_encoded":      orig_enc,
        "Destination_encoded":  dest_enc,
        "DayOfWeek":            day,
        "Time_Sin":             sin_val,
        "Time_Cos":             cos_val,
    }])

    prediction = float(model.predict(features)[0])
    return jsonify({"ratio": round(prediction, 4)})


# ── Run ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("Namma Boarding Assistant API -> http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=True)
