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
        if (!response.ok) throw new Error('Failed to fetch expenses');
        
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

// Load stats and update charts
async function loadStats(startDate = '', endDate = '') {
    try {
        let url = '/get_stats';
        if (startDate && endDate) {
            url += `?start_date=${startDate}&end_date=${endDate}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch stats');
        
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
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Format date as DD/MM/YYYY
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN'); // Indian date format
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
        
        if (!response.ok) throw new Error('Failed to save expense');
        
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
        }
    } catch (error) {
        console.error('Error saving expense:', error);
        alert('Failed to save expense. Please try again.');
    }
});

// Handle edit button click
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('edit-btn')) {
        const id = parseInt(e.target.dataset.id);
        try {
            // Fetch all expenses
            const response = await fetch('/get_expenses');
            if (!response.ok) throw new Error('Failed to fetch expenses');
            
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
            alert('Failed to prepare edit. Please try again.');
        }
    }
    
    if (e.target.classList.contains('delete-btn')) {
        const id = e.target.dataset.id;
        try {
            const response = await fetch(`/delete_expense/${id}`, { 
                method: 'DELETE' 
            });
            if (!response.ok) throw new Error('Failed to delete');
            loadExpenses();
            loadStats();
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('Failed to delete expense. Please try again.');
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
    
    loadExpenses();
    loadStats();
});