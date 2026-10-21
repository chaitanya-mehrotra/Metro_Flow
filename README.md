# 🚇 MetroFlow — Namma Boarding Assistant

An AI-powered smart transit recommendation and crowd density forecasting system designed for Bangalore Namma Metro commuters.

[![Live Demo](https://img.shields.io/badge/Demo-Live%20on%20Render-brightgreen?style=for-the-badge&logo=render)](https://metro-flow-jfp8.onrender.com)
[![Python](https://img.shields.io/badge/Python-3.12-blue?style=for-the-badge&logo=python)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-Web%20API-black?style=for-the-badge&logo=flask)](https://flask.palletsprojects.com/)

---

## 🌐 Live Demo Link

Experience the live interactive web dashboard here:  
👉 **[https://metro-flow-jfp8.onrender.com](https://metro-flow-jfp8.onrender.com)**

*(Works on any device — laptops, tablets, and smartphones!)*

---

## ✨ Features

- **Real-Time Crowd Density Prediction:** Uses a trained Multi-Layer Perceptron (MLP) neural network (`metro_mlp_model.pkl`) to project crowd congestion ratios.
- **Smart Commuter Recommendation Engine:** Analyzes current time slots against -15 min and +15 min departure windows, recommending the optimal, least-crowded travel time.
- **Full Bangalore Namma Metro Network:** Covers all 83 stations across Purple and Green lines with full station name mapping.
- **Interactive Web Dashboard:** Beautiful modern interface featuring searchable station dropdowns, dynamic metric meters, and crowd trend charts.
- **CLI Mode:** Includes a dedicated command-line diagnostic tool (`cli.py`) for rapid terminal simulations.

---

## 🛠️ Tech Stack

- **Machine Learning:** Scikit-Learn (MLP Regressor), Joblib, NumPy, Pandas
- **Backend API:** Python Flask, Flask-CORS
- **Frontend Dashboard:** Vanilla JavaScript, Modern CSS3 Glassmorphism, Semantic HTML5
- **Hosting & Deployment:** Render Cloud Platform

---

## 🚀 Running Locally

### 1. Clone the repository
```bash
git clone https://github.com/chaitanya-mehrotra/Metro_Flow.git
cd Metro_Flow
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Flask Web Server
```bash
python server.py
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser.

### 4. Or Run CLI Mode
```bash
python cli.py
```

---

## 👥 Authors & License
Developed for the AI Project Based Learning (PBL) curriculum by **Chaitanya Mehrotra**.
