from flask import Flask, render_template, request, redirect, url_for, session, jsonify, Response
from werkzeug.security import generate_password_hash, check_password_hash
import json
import os
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'

# Simple database simulation
USERS_FILE = 'users.json'
EXPENSES_FILE = 'expenses.json'

def load_data(filename):
    if not os.path.exists(filename):
        return {}
    with open(filename, 'r') as f:
        return json.load(f)

def save_data(data, filename):
    with open(filename, 'w') as f:
        json.dump(data, f)

# Initialize with some dummy data
if not os.path.exists(USERS_FILE):
    users = {
        "user1": {
            "password": generate_password_hash("password123"),
            "email": "user1@example.com"
        }
    }
    save_data(users, USERS_FILE)

if not os.path.exists(EXPENSES_FILE):
    expenses = {
        "user1": [
            {"id": 1, "amount": 50, "category": "Education", "description": "Books", "date": "2023-09-20"},
            {"id": 2, "amount": 120, "category": "Home", "description": "Groceries", "date": "2023-09-21"},
            {"id": 3, "amount": 30, "category": "Hobby", "description": "Movie", "date": "2023-09-22"}
        ]
    }
    save_data(expenses, EXPENSES_FILE)

@app.route('/')
def home():
    if 'username' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('auth', mode='login'))

@app.route('/auth/<mode>', methods=['GET', 'POST'])
def auth(mode):
    if request.method == 'POST':
        users = load_data(USERS_FILE)
        username = request.form['username']
        password = request.form['password']
        
        if mode == 'login':
            if username in users and check_password_hash(users[username]['password'], password):
                session['username'] = username
                return redirect(url_for('dashboard'))
            return render_template('auth.html', mode=mode, error="Invalid credentials")
        else:  # signup
            if username in users:
                return render_template('auth.html', mode=mode, error="Username already exists")
            users[username] = {
                "password": generate_password_hash(password),
                "email": request.form.get('email', '')
            }
            save_data(users, USERS_FILE)
            
            # Initialize empty expenses for new user
            expenses = load_data(EXPENSES_FILE)
            expenses[username] = []
            save_data(expenses, EXPENSES_FILE)
            
            session['username'] = username
            return redirect(url_for('dashboard'))
    
    return render_template('auth.html', mode=mode)

@app.route('/dashboard')
def dashboard():
    if 'username' not in session:
        return redirect(url_for('auth', mode='login'))
    return render_template('dashboard.html', username=session['username'])

@app.route('/add_expense', methods=['POST'])
def add_expense():
    if 'username' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    expenses = load_data(EXPENSES_FILE)
    username = session['username']
    
    new_expense = {
        "id": len(expenses[username]) + 1,
        "amount": float(request.form['amount']),
        "category": request.form['category'],
        "description": request.form['description'],
        "date": request.form.get('date', datetime.now().strftime('%Y-%m-%d'))
    }
    
    expenses[username].append(new_expense)
    save_data(expenses, EXPENSES_FILE)
    
    return jsonify({"success": True, "expense": new_expense})

@app.route('/get_expenses')
def get_expenses():
    if 'username' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    expenses = load_data(EXPENSES_FILE)
    user_expenses = expenses.get(session['username'], [])
    
    # Date filtering
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    if start_date and end_date:
        user_expenses = [e for e in user_expenses if start_date <= e['date'] <= end_date]
    
    return jsonify(user_expenses)

@app.route('/update_expense', methods=['POST'])
def update_expense():
    if 'username' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    expenses = load_data(EXPENSES_FILE)
    username = session['username']
    expense_id = int(request.form['id'])
    
    for expense in expenses[username]:
        if expense['id'] == expense_id:
            expense.update({
                "amount": float(request.form['amount']),
                "category": request.form['category'],
                "description": request.form['description'],
                "date": request.form['date']
            })
            break
    
    save_data(expenses, EXPENSES_FILE)
    return jsonify({"success": True})

@app.route('/delete_expense/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    if 'username' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    expenses = load_data(EXPENSES_FILE)
    username = session['username']
    expenses[username] = [e for e in expenses[username] if e['id'] != expense_id]
    
    save_data(expenses, EXPENSES_FILE)
    return jsonify({"success": True})

@app.route('/get_stats')
def get_stats():
    if 'username' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    expenses = load_data(EXPENSES_FILE)
    user_expenses = expenses.get(session['username'], [])
    
    # Date filtering for stats
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    if start_date and end_date:
        user_expenses = [e for e in user_expenses if start_date <= e['date'] <= end_date]
    
    stats = {
        "total": sum(exp['amount'] for exp in user_expenses),
        "by_category": {},
        "monthly_totals": {}
    }
    
    # Calculate category totals
    for exp in user_expenses:
        stats["by_category"][exp['category']] = stats["by_category"].get(exp['category'], 0) + exp['amount']
        
        # Calculate monthly totals
        month = exp['date'][:7]  # YYYY-MM
        stats["monthly_totals"][month] = stats["monthly_totals"].get(month, 0) + exp['amount']
    
    return jsonify(stats)

@app.route('/export_expenses')
def export_expenses():
    if 'username' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    expenses = load_data(EXPENSES_FILE)
    user_expenses = expenses.get(session['username'], [])
    
    csv_data = "Date,Description,Category,Amount\n"
    for exp in user_expenses:
        csv_data += f"{exp['date']},{exp['description']},{exp['category']},{exp['amount']}\n"
    
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=expenses.csv"}
    )

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('auth', mode='login'))

if __name__ == '__main__':
    app.run(debug=True)