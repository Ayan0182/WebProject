from flask import Flask, render_template, request, redirect, url_for, session, jsonify, Response
from werkzeug.security import generate_password_hash, check_password_hash
import json
import os
from datetime import datetime
import logging

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'

# Setup logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

# File paths
USERS_FILE = 'users.json'
EXPENSES_FILE = 'expenses.json'
BUDGETS_FILE = 'budgets.json'

def load_data(filename):
    try:
        if not os.path.exists(filename):
            logging.info(f"File {filename} does not exist, returning empty dict")
            return {}
        with open(filename, 'r') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"Error loading {filename}: {str(e)}")
        raise

def save_data(data, filename):
    try:
        with open(filename, 'w') as f:
            json.dump(data, f)
        logging.info(f"Successfully saved data to {filename}")
    except Exception as e:
        logging.error(f"Error saving {filename}: {str(e)}")
        raise

# Initialize files if they don't exist
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

if not os.path.exists(BUDGETS_FILE):
    budgets = {}
    save_data(budgets, BUDGETS_FILE)

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
                logging.info(f"User {username} logged in")
                return redirect(url_for('dashboard'))
            logging.warning(f"Failed login attempt for {username}")
            return render_template('auth.html', mode=mode, error="Invalid credentials")
        else:  # signup
            if username in users:
                logging.warning(f"Signup failed: Username {username} already exists")
                return render_template('auth.html', mode=mode, error="Username already exists")
            users[username] = {
                "password": generate_password_hash(password),
                "email": request.form.get('email', '')
            }
            save_data(users, USERS_FILE)
            
            # Initialize empty expenses and budgets for new user
            expenses = load_data(EXPENSES_FILE)
            expenses[username] = []
            save_data(expenses, EXPENSES_FILE)
            
            budgets = load_data(BUDGETS_FILE)
            budgets[username] = {}
            save_data(budgets, BUDGETS_FILE)
            
            session['username'] = username
            logging.info(f"User {username} signed up")
            return redirect(url_for('dashboard'))
    
    return render_template('auth.html', mode=mode)

@app.route('/dashboard')
def dashboard():
    if 'username' not in session:
        logging.warning("Unauthorized dashboard access attempt")
        return redirect(url_for('auth', mode='login'))
    return render_template('dashboard.html', username=session['username'])

@app.route('/add_expense', methods=['POST'])
def add_expense():
    if 'username' not in session:
        logging.warning("Unauthorized add_expense attempt")
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
    logging.info(f"Expense added for {username}: {new_expense}")
    
    return jsonify({"success": True, "expense": new_expense})

@app.route('/get_expenses')
def get_expenses():
    if 'username' not in session:
        logging.warning("Unauthorized get_expenses attempt")
        return jsonify({"error": "Not authenticated"}), 401
    
    expenses = load_data(EXPENSES_FILE)
    user_expenses = expenses.get(session['username'], [])
    
    # Date filtering
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    if start_date and end_date:
        user_expenses = [e for e in user_expenses if start_date <= e['date'] <= end_date]
    
    logging.info(f"Retrieved {len(user_expenses)} expenses for {session['username']}")
    return jsonify(user_expenses)

@app.route('/update_expense', methods=['POST'])
def update_expense():
    if 'username' not in session:
        logging.warning("Unauthorized update_expense attempt")
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
    logging.info(f"Expense {expense_id} updated for {username}")
    return jsonify({"success": True})

@app.route('/delete_expense/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    if 'username' not in session:
        logging.warning("Unauthorized delete_expense attempt")
        return jsonify({"error": "Not authenticated"}), 401
    
    expenses = load_data(EXPENSES_FILE)
    username = session['username']
    expenses[username] = [e for e in expenses[username] if e['id'] != expense_id]
    
    save_data(expenses, EXPENSES_FILE)
    logging.info(f"Expense {expense_id} deleted for {username}")
    return jsonify({"success": True})

@app.route('/get_stats')
def get_stats():
    if 'username' not in session:
        logging.warning("Unauthorized get_stats attempt")
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
    
    logging.info(f"Stats retrieved for {session['username']}")
    return jsonify(stats)

@app.route('/add_budget', methods=['POST'])
def add_budget():
    if 'username' not in session:
        logging.warning("Unauthorized add_budget attempt")
        return jsonify({"error": "Not authenticated"}), 401
    
    budgets = load_data(BUDGETS_FILE)
    username = session['username']
    
    month = request.form['month']
    category = request.form['category']
    amount = float(request.form['amount'])
    
    # Initialize user budgets if not exists
    if username not in budgets:
        budgets[username] = {}
    
    # Initialize month budgets if not exists
    if month not in budgets[username]:
        budgets[username][month] = {}
    
    # Set budget for category
    budgets[username][month][category] = amount
    
    save_data(budgets, BUDGETS_FILE)
    logging.info(f"Budget added for {username}: {month}, {category}, ₹{amount}")
    
    return jsonify({"success": True, "budget": {"month": month, "category": category, "amount": amount}})

@app.route('/get_budgets')
def get_budgets():
    if 'username' not in session:
        logging.warning("Unauthorized get_budgets attempt")
        return jsonify({"error": "Not authenticated"}), 401
    
    budgets = load_data(BUDGETS_FILE)
    user_budgets = budgets.get(session['username'], {})
    
    # Flatten budgets for easier frontend processing
    budget_list = []
    for month, categories in user_budgets.items():
        for category, amount in categories.items():
            budget_list.append({"month": month, "category": category, "amount": amount})
    
    logging.info(f"Retrieved {len(budget_list)} budgets for {session['username']}")
    return jsonify(budget_list)

@app.route('/update_budget', methods=['POST'])
def update_budget():
    if 'username' not in session:
        logging.warning("Unauthorized update_budget attempt")
        return jsonify({"error": "Not authenticated"}), 401
    
    budgets = load_data(BUDGETS_FILE)
    username = session['username']
    
    month = request.form['month']
    category = request.form['category']
    amount = float(request.form['amount'])
    
    if username in budgets and month in budgets[username] and category in budgets[username][month]:
        budgets[username][month][category] = amount
        save_data(budgets, BUDGETS_FILE)
        logging.info(f"Budget updated for {username}: {month}, {category}, ₹{amount}")
        return jsonify({"success": True})
    
    logging.warning(f"Budget not found for {username}: {month}, {category}")
    return jsonify({"error": "Budget not found"}), 404

@app.route('/delete_budget', methods=['POST'])
def delete_budget():
    if 'username' not in session:
        logging.warning("Unauthorized delete_budget attempt")
        return jsonify({"error": "Not authenticated"}), 401
    
    budgets = load_data(BUDGETS_FILE)
    username = session['username']
    
    month = request.form.get('month')
    category = request.form.get('category')
    
    if not month or not category:
        logging.error(f"Missing month or category in delete_budget request for {username}")
        return jsonify({"error": "Missing month or category"}), 400
    
    if username in budgets and month in budgets[username] and category in budgets[username][month]:
        del budgets[username][month][category]
        if not budgets[username][month]:  # Clean up empty month
            del budgets[username][month]
        if not budgets[username]:  # Clean up empty user
            del budgets[username]
        save_data(budgets, BUDGETS_FILE)
        logging.info(f"Budget deleted for {username}: {month}, {category}")
        return jsonify({"success": True})
    
    logging.warning(f"Budget not found for {username}: {month}, {category}")
    return jsonify({"error": "Budget not found"}), 404

@app.route('/export_expenses')
def export_expenses():
    if 'username' not in session:
        logging.warning("Unauthorized export_expenses attempt")
        return jsonify({"error": "Not authenticated"}), 401
    
    expenses = load_data(EXPENSES_FILE)
    user_expenses = expenses.get(session['username'], [])
    
    csv_data = "Date,Description,Category,Amount\n"
    for exp in user_expenses:
        csv_data += f"{exp['date']},{exp['description']},{exp['category']},{exp['amount']}\n"
    
    logging.info(f"Exported expenses for {session['username']}")
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=expenses.csv"}
    )

@app.route('/logout')
def logout():
    username = session.get('username', 'unknown')
    session.pop('username', None)
    logging.info(f"User {username} logged out")
    return redirect(url_for('auth', mode='login'))

if __name__ == '__main__':
    app.run(debug=True)