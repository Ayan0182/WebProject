let categoryChart;
let barChart;

// Load expenses and populate table
async function loadExpenses(startDate = '', endDate = '') {
    try {
        let url = '/get_expenses';
        if (startDate && endDate) {
            url += `?start_date=${startDate}&end_date=${endDate}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch expenses: ${response.status}`);
        
        const expenses = await response.json();
        const tbody = document.querySelector('#expenses-table tbody');
        tbody.innerHTML = '';
        
        if (expenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No expenses recorded yet</td></tr>';
            return;
        }
        
        // Sort by date (newest first)
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        expenses.forEach(expense => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatDate(expense.date)}</td>
                <td>${expense.description}</td>
                <td><span class="category-badge category-${expense.category}">${expense.category}</span></td>
                <td>₹${expense.amount.toFixed(2)}</td>
                <td>
                    <button class="edit-btn" data-id="${expense.id}">Edit</button>
                    <button class="delete-btn" data-id="${expense.id}">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading expenses:', error);
        alert('Failed to load expenses. Please try again.');
    }
}

// Load budgets and populate table
async function loadBudgets() {
    try {
        const response = await fetch('/get_budgets');
        if (!response.ok) throw new Error(`Failed to fetch budgets: ${response.status}`);
        
        const budgets = await response.json();
        const expensesResponse = await fetch('/get_expenses');
        if (!expensesResponse.ok) throw new Error(`Failed to fetch expenses: ${expensesResponse.status}`);
        
        const expenses = await expensesResponse.json();
        const tbody = document.querySelector('#budget-table tbody');
        tbody.innerHTML = '';
        
        if (budgets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No budgets set yet</td></tr>';
            return;
        }
        
        budgets.forEach(budget => {
            // Calculate spent amount for the budget's month and category
            const spent = expenses
                .filter(exp => exp.date.startsWith(budget.month) && exp.category === budget.category)
                .reduce((sum, exp) => sum + exp.amount, 0);
            
            const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
            const status = percentage >= 100 ? 'danger' : percentage >= 80 ? 'warning' : 'safe';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${budget.month}</td>
                <td>${budget.category}</td>
                <td>₹${budget.amount.toFixed(2)}</td>
                <td>₹${spent.toFixed(2)}</td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-bar-fill ${status}" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                </td>
                <td>
                    ${percentage >= 80 ? `<span class="alert-message ${status}">${percentage >= 100 ? 'Budget Exceeded!' : 'Approaching Limit'}</span>` : 'On Track'}
                    <button class="delete-btn" data-month="${budget.month}" data-category="${budget.category}">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading budgets:', error);
        alert('Failed to load budgets. Please try again.');
    }
}

// Handle budget form submission
document.getElementById('budget-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const month = document.getElementById('budget-month').value;
    const category = document.getElementById('budget-category').value;
    const amount = parseFloat(document.getElementById('budget-amount').value);
    
    if (!month || !category || isNaN(amount) || amount <= 0) {
        alert('Please fill all fields correctly with a valid amount.');
        return;
    }
    
    try {
        const response = await fetch('/add_budget', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                month,
                category,
                amount
            })
        });
        
        if (!response.ok) throw new Error(`Failed to save budget: ${response.status}`);
        
        const result = await response.json();
        if (result.success) {
            document.getElementById('budget-form').reset();
            document.getElementById('budget-month').value = new Date().toISOString().slice(0, 7);
            loadBudgets();
        } else {
            throw new Error(result.error || 'Unknown error saving budget');
        }
    } catch (error) {
        console.error('Error saving budget:', error);
        alert(`Failed to save budget: ${error.message}`);
    }
});

// Handle budget delete button click
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn') && e.target.dataset.month && e.target.dataset.category) {
        const month = e.target.dataset.month;
        const category = e.target.dataset.category;
        console.log(`Attempting to delete budget: month=${month}, category=${category}`); // Debug log
        
        try {
            const response = await fetch('/delete_budget', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    month,
                    category
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to delete budget: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.success) {
                console.log(`Budget deleted successfully: month=${month}, category=${category}`);
                loadBudgets();
            } else {
                throw new Error(result.error || 'Unknown error deleting budget');
            }
        } catch (error) {
            console.error('Error deleting budget:', error);
            alert(`Failed to delete budget: ${error.message}`);
        }
    }
});

// Load stats and update charts
async function loadStats(startDate = '', endDate = '') {
    try {
        let url = '/get_stats';
        if (startDate && endDate) {
            url += `?start_date=${startDate}&end_date=${endDate}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch stats: ${response.status}`);
        
        const stats = await response.json();
        
        // Update total amount
        document.getElementById('total-amount').textContent = `₹${stats.total.toFixed(2)}`;
        
        // Prepare data for pie chart
        const categories = Object.keys(stats.by_category);
        const amounts = Object.values(stats.by_category);
        
        // Generate colors based on categories
        const backgroundColors = categories.map(category => {
            switch(category) {
                case 'Home': return '#ffec99';
                case 'Education': return '#b2f2bb';
                case 'Hobby': return '#ffc9c9';
                case 'Transportation': return '#a5d8ff';
                case 'Food': return '#ffd8a8';
                case 'Health': return '#d0bfff';
                default: return '#e9ecef';
            }
        });
        
        // Update chart colors based on theme
        updateChartColors(backgroundColors);
        
        // Create or update pie chart
        const pieCtx = document.getElementById('categoryChart').getContext('2d');
        
        if (categoryChart) {
            categoryChart.data.labels = categories;
            categoryChart.data.datasets[0].data = amounts;
            categoryChart.data.datasets[0].backgroundColor = backgroundColors;
            categoryChart.update();
        } else {
            categoryChart = new Chart(pieCtx, {
                type: 'pie',
                data: {
                    labels: categories,
                    datasets: [{
                        data: amounts,
                        backgroundColor: backgroundColors,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = Math.round((value / total) * 100);
                                    return `${label}: ₹${value.toFixed(2)} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
        
        // Prepare data for bar chart (monthly totals)
        const months = Object.keys(stats.monthly_totals).sort();
        const monthlyAmounts = months.map(month => stats.monthly_totals[month]);
        
        // Create or update bar chart
        const barCtx = document.getElementById('barChart').getContext('2d');
        
        if (barChart) {
            barChart.data.labels = months;
            barChart.data.datasets[0].data = monthlyAmounts;
            barChart.update();
        } else {
            barChart = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Monthly Spending',
                        data: monthlyAmounts,
                        backgroundColor: '#4361ee',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        // Add budget alerts
        const budgetsResponse = await fetch('/get_budgets');
        if (budgetsResponse.ok) {
            const budgets = await budgetsResponse.json();
            const totalAmountElement = document.getElementById('total-amount');
            // Clear existing alerts
            const existingAlerts = totalAmountElement.parentElement.querySelectorAll('.alert-message');
            existingAlerts.forEach(alert => alert.remove());
            
            budgets.forEach(budget => {
                const spent = stats.by_category[budget.category] || 0;
                if (budget.month === new Date().toISOString().slice(0, 7)) { // Current month
                    if (spent >= budget.amount) {
                        const alert = document.createElement('div');
                        alert.className = 'alert-message danger';
                        alert.textContent = `Warning: You have exceeded your ${budget.category} budget!`;
                        totalAmountElement.parentElement.appendChild(alert);
                    } else if (spent >= budget.amount * 0.8) {
                        const alert = document.createElement('div');
                        alert.className = 'alert-message warning';
                        alert.textContent = `Warning: You are approaching your ${budget.category} budget!`;
                        totalAmountElement.parentElement.appendChild(alert);
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        //loadStats();
        //alert('Failed to load stats. Please try again.');
    }
}

// Update chart colors based on theme
function updateChartColors(backgroundColors) {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const chartColors = isDarkMode ? {
        backgroundColor: backgroundColors.map(color => adjustColorForDarkMode(color)),
        borderColor: '#e0e0e0',
        textColor: '#e0e0e0'
    } : {
        backgroundColor: backgroundColors,
        borderColor: '#212529',
        textColor: '#212529'
    };
    
    if (categoryChart) {
        categoryChart.data.datasets[0].backgroundColor = chartColors.backgroundColor;
        categoryChart.data.datasets[0].borderColor = chartColors.borderColor;
        categoryChart.options.plugins.legend.labels.color = chartColors.textColor;
        categoryChart.options.plugins.title.color = chartColors.textColor;
        categoryChart.update();
    }
    
    if (barChart) {
        barChart.data.datasets[0].backgroundColor = isDarkMode ? '#6b8cff' : '#4361ee';
        barChart.data.datasets[0].borderColor = chartColors.borderColor;
        barChart.options.scales.x.axes[0].ticks.color = chartColors.textColor;
        barChart.options.scales.y.axes[0].ticks.color = chartColors.textColor;
        barChart.options.plugins.legend.labels.color = chartColors.textColor;
        barChart.options.plugins.title.color = chartColors.textColor;
        barChart.update();
    }
}

// Helper function to adjust colors for dark mode
function adjustColorForDarkMode(color) {
    // Simple adjustment: lighten the color for dark mode
    const rgb = hexToRgb(color);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.l = Math.min(hsl.l * 1.2, 100); // Increase lightness by 20%
    const adjustedRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    return rgbToHex(adjustedRgb.r, adjustedRgb.g, adjustedRgb.b);
}

// Color conversion helpers
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    
    return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToHex(r, g, b) {
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Format date as DD/MM/YYYY
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN');
}

// Handle form submission
document.getElementById('expense-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const description = document.getElementById('description').value;
    const date = document.getElementById('date').value || new Date().toISOString().split('T')[0];
    const form = e.target;
    
    try {
        let response;
        let url;
        let method;
        
        if (form.dataset.editMode === 'true') {
            // Update existing expense
            method = 'POST';
            url = '/update_expense';
            const id = form.dataset.editId;
            response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    id,
                    amount,
                    category,
                    description,
                    date
                })
            });
        } else {
            // Add new expense
            method = 'POST';
            url = '/add_expense';
            response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    amount,
                    category,
                    description,
                    date
                })
            });
        }
        
        if (!response.ok) throw new Error(`Failed to save expense: ${response.status}`);
        
        const result = await response.json();
        if (result.success) {
            // Reset form
            form.reset();
            delete form.dataset.editMode;
            delete form.dataset.editId;
            document.getElementById('date').valueAsDate = new Date();
            
            // Change button text back
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Add Expense';
            
            // Refresh data
            loadExpenses();
            loadStats();
            loadBudgets(); // Refresh budgets to update spent amounts
        } else {
            throw new Error(result.error || 'Unknown error saving expense');
        }
    } catch (error) {
        console.error('Error saving expense:', error);
        alert(`Failed to save expense: ${error.message}`);
    }
});

// Handle edit button click
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('edit-btn')) {
        const id = parseInt(e.target.dataset.id);
        try {
            // Fetch all expenses
            const response = await fetch('/get_expenses');
            if (!response.ok) throw new Error(`Failed to fetch expenses: ${response.status}`);
            
            const expenses = await response.json();
            const expenseToEdit = expenses.find(exp => exp.id === id);
            
            if (!expenseToEdit) throw new Error('Expense not found');
            
            // Populate the form with existing data
            document.getElementById('amount').value = expenseToEdit.amount;
            document.getElementById('category').value = expenseToEdit.category;
            document.getElementById('description').value = expenseToEdit.description;
            document.getElementById('date').value = expenseToEdit.date;
            
            // Change the form to update mode
            const form = document.getElementById('expense-form');
            form.dataset.editMode = 'true';
            form.dataset.editId = id;
            
            // Change the button text
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Update Expense';
            
            // Scroll to form
            form.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            console.error('Error preparing edit:', error);
            alert(`Failed to prepare edit: ${error.message}`);
        }
    }
    
    if (e.target.classList.contains('delete-btn') && !e.target.dataset.month) {
        const id = e.target.dataset.id;
        try {
            const response = await fetch(`/delete_expense/${id}`, { 
                method: 'DELETE' 
            });
            if (!response.ok) throw new Error(`Failed to delete expense: ${response.status}`);
            loadExpenses();
            loadStats();
            loadBudgets(); // Refresh budgets to update spent amounts
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert(`Failed to delete expense: ${error.message}`);
        }
    }
});

// Handle filter button click
document.getElementById('filter-btn').addEventListener('click', () => {
    const start = document.getElementById('start-date').value;
    const end = document.getElementById('end-date').value;
    if (start && end) {
        loadExpenses(start, end);
        loadStats(start, end);
    } else {
        alert('Please select both start and end dates');
    }
});

// Handle export button click
document.getElementById('export-btn').addEventListener('click', () => {
    window.location.href = '/export_expenses';
});

// Initialize date pickers and load data
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('start-date').valueAsDate = new Date(new Date().setMonth(new Date().getMonth() - 1));
    document.getElementById('end-date').valueAsDate = new Date();
    document.getElementById('budget-month').value = new Date().toISOString().slice(0, 7); // Set default to current month
    
    loadExpenses();
    loadStats();
    loadBudgets();
});