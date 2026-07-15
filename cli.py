import numpy as np
import pandas as pd
import joblib
import sys
import warnings

# Silence the feature name warning cleanly
warnings.filterwarnings("ignore", category=UserWarning)

# 1. LOAD THE TRAINED ARTIFACTS
try:
    model = joblib.load("metro_mlp_model.pkl")
    le_station = joblib.load("le_station.pkl")
    le_dest = joblib.load("le_dest.pkl")
    all_stations = sorted(list(le_station.classes_))
    print("✔ Model and encoders loaded successfully!\n")
except Exception as e:
    print(f"❌ Error loading model artifacts: {e}")
    sys.exit(1)

print("====================================================")
print("🚇 NAMMA BOARDING ASSISTANT - SMART RECOMMENDATION BENCH")
print("====================================================")
print("Type 'exit' at any station prompt to quit.\n")

# Helper function to compute predictions for any given fractional hour
def predict_for_time(orig_enc, dest_enc, day, frac_time):
    # Compute continuous vectors for this specific slot
    sin_val = np.sin(2 * np.pi * frac_time / 24.0)
    cos_val = np.cos(2 * np.pi * frac_time / 24.0)
    
    # Structure as a dictionary matching training features
    features = pd.DataFrame([{
        'STATION_encoded': orig_enc,
        'Destination_encoded': dest_enc,
        'DayOfWeek': day,
        'Time_Sin': sin_val,
        'Time_Cos': cos_val
    }])
    return model.predict(features)[0]

# Helper function to convert fractional hours back to HH:MM format
def format_fractional_time(frac_time):
    # Ensure times wrap around 24 hours cleanly
    frac_time = frac_time % 24
    hours = int(frac_time)
    minutes = int(round((frac_time - hours) * 60))
    if minutes == 60:
        hours = (hours + 1) % 24
        minutes = 0
    return f"{hours:02d}:{minutes:02d}"

while True:
    print("----------------------------------------------------")
    # 2. INPUT COLLECTION
    origin = input("Enter Origin Station: ").strip()
    if origin.lower() == 'exit': break
    if origin not in all_stations:
        print(f"❌ Station '{origin}' not found. Try again.")
        continue
        
    destination = input("Enter Destination Station: ").strip()
    if destination.lower() == 'exit': break
    if destination not in all_stations:
        print(f"❌ Station '{destination}' not found. Try again.")
        continue
    if origin == destination:
        print("❌ Origin and Destination cannot be identical!")
        continue

    try:
        day = int(input("Enter Day of Week (1=Mon, 7=Sun): "))
        if not (1 <= day <= 7): continue
            
        time_str = input("Enter Intended Time (HH:MM, e.g., 17:15): ").strip()
        hour, minute = map(int, time_str.split(":"))
        if not (0 <= hour <= 23 and 0 <= minute <= 59): continue
    except ValueError:
        print("❌ Invalid entry format.")
        continue

    # Encode stations once
    orig_encoded = le_station.transform([origin])[0]
    dest_encoded = le_dest.transform([destination])[0]
    
    # 3. MULTI-SLOT CALCULATION (The 3-Point Window)
    target_time = hour + (minute / 60.0)
    earlier_time = target_time - 0.25  # Minus 15 minutes (0.25 of an hour)
    later_time = target_time + 0.25    # Plus 15 minutes

    # Run inference across the whole window
    ratio_earlier = predict_for_time(orig_encoded, dest_encoded, day, earlier_time)
    ratio_target = predict_for_time(orig_encoded, dest_encoded, day, target_time)
    ratio_later = predict_for_time(orig_encoded, dest_encoded, day, later_time)

    # 4. PRINT PREDICTION DASHBOARD
    print("\n[🕒 TIME SLOT ANALYSIS]")
    print(f"  • {format_fractional_time(earlier_time)} (-15 mins) : {ratio_earlier:.3f}x")
    print(f"  • {format_fractional_time(target_time)} (Your Time)  : {ratio_target:.3f}x")
    print(f"  • {format_fractional_time(later_time)} (+15 mins) : {ratio_later:.3f}x")
    print("----------------------------------------------------")

    # 5. SMART RECOMMENDATION LOGIC - FINAL REFINED VERSION
    slots = {
        earlier_time: ratio_earlier,
        target_time: ratio_target,
        later_time: ratio_later
    }
    
    # Find the absolute best slot out of all three
    best_time = min(slots, key=slots.get)
    
    print("[💡 AI COMMUTER RECOMMENDATION]")
    
    # If your intended time is already the absolute lowest multiplier, it's the winner
    if best_time == target_time:
        print(f"✅ Your intended time ({format_fractional_time(target_time)}) is the best choice!")
        print("   Adjacent slots show a higher crowd density projection.")
        
    else:
        # Calculate exactly how much crowd density you save by switching to the best slot
        crowd_savings = ratio_target - slots[best_time]
        time_diff = "15 minutes earlier" if best_time < target_time else "15 minutes later"
        
        # Lowered threshold to 0.01x to catch real, smooth trend shifts
        if crowd_savings >= 0.01:
            print(f"⚠️ Alternate Slot Advised: Traveling at **{format_fractional_time(best_time)}** ({time_diff}) is better.")
            print(f"   It cuts down crowding density by an additional {crowd_savings:.3f}x.")
        else:
            # If the difference is practically zero (less than 0.01x), stick to your time
            print(f"✅ Your intended time ({format_fractional_time(target_time)}) is perfectly fine.")
            print("   Any adjacent shifts offer no noticeable difference in comfort.")