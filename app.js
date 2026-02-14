// Dashboard Ordini Genuine Leather - App JS

let allOrders = [];
let filteredOrders = [];
let charts = {};

// Colori per i siti
const siteColors = {
    IT: '#27ae60',
    FR: '#3498db',
    ES: '#f39c12'
};

// Inizializzazione
document.addEventListener('DOMContentLoaded', async () => {
    setupFilters();
    await loadData();
});

// Setup filtri
function setupFilters() {
    document.querySelectorAll('#periodFilter button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#periodFilter button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            applyFilters();
        });
    });

    document.querySelectorAll('#siteFilter button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#siteFilter button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            applyFilters();
        });
    });
}

// Carica dati
async function loadData() {
    try {
        const response = await fetch('data/orders.json');
        if (!response.ok) throw new Error('Dati non disponibili');

        const data = await response.json();
        allOrders = data.orders || [];

        // Aggiorna timestamp
        const lastUpdate = new Date(data.stats?.last_update);
        document.getElementById('lastUpdate').textContent =
            `Ultimo aggiornamento: ${formatDate(lastUpdate)} ${formatTime(lastUpdate)}`;

        applyFilters();
    } catch (error) {
        console.error('Errore caricamento dati:', error);
        document.getElementById('lastUpdate').textContent = 'Errore caricamento dati';
    }
}

// Applica filtri
function applyFilters() {
    const period = document.querySelector('#periodFilter button.active').dataset.period;
    const site = document.querySelector('#siteFilter button.active').dataset.site;

    let orders = [...allOrders];

    // Filtro periodo
    if (period !== 'all') {
        const days = parseInt(period);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        orders = orders.filter(o => new Date(o.date_created) >= cutoff);
    }

    // Filtro sito
    if (site !== 'all') {
        orders = orders.filter(o => o.site === site);
    }

    filteredOrders = orders;
    updateDashboard();
}

// Aggiorna dashboard
function updateDashboard() {
    updateKPIs();
    updateSiteKPIs();
    updateCharts();
    updateTables();
}

// Aggiorna KPI principali
function updateKPIs() {
    const completedStatuses = ['completed', 'processing'];
    const validOrders = filteredOrders.filter(o => completedStatuses.includes(o.status));

    const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = validOrders.length;
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const uniqueEmails = new Set(validOrders.map(o => o.customer?.email).filter(Boolean));

    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('totalOrders').textContent = totalOrders.toLocaleString('it-IT');
    document.getElementById('avgOrder').textContent = formatCurrency(avgOrder);
    document.getElementById('uniqueCustomers').textContent = uniqueEmails.size.toLocaleString('it-IT');
}

// Aggiorna KPI per sito
function updateSiteKPIs() {
    const completedStatuses = ['completed', 'processing'];

    ['IT', 'FR', 'ES'].forEach(site => {
        const siteOrders = filteredOrders.filter(o =>
            o.site === site && completedStatuses.includes(o.status)
        );
        const revenue = siteOrders.reduce((sum, o) => sum + o.total, 0);

        document.getElementById(`revenue${site}`).textContent = formatCurrency(revenue);
        document.getElementById(`orders${site}`).textContent = `${siteOrders.length} ordini`;
    });
}

// Aggiorna grafici
function updateCharts() {
    updateBrandsChart();
    updatePaymentChart();
}

// Grafico brand (barre verticali, pezzi venduti)
function updateBrandsChart() {
    const ctx = document.getElementById('brandsChart').getContext('2d');
    const completedStatuses = ['completed', 'processing'];

    const brandPieces = {};
    filteredOrders.filter(o => completedStatuses.includes(o.status)).forEach(order => {
        order.items?.forEach(item => {
            const brand = item.brand || 'N/D';
            if (!brandPieces[brand]) brandPieces[brand] = 0;
            brandPieces[brand] += item.quantity;
        });
    });

    const sorted = Object.entries(brandPieces)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    if (charts.brands) charts.brands.destroy();

    charts.brands = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(([brand]) => truncate(brand, 15)),
            datasets: [{
                label: 'Pezzi',
                data: sorted.map(([, qty]) => qty),
                backgroundColor: '#3498db',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.raw} pezzi`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Grafico metodi pagamento
function updatePaymentChart() {
    const ctx = document.getElementById('paymentChart').getContext('2d');
    const completedStatuses = ['completed', 'processing'];

    const paymentMethods = {};
    filteredOrders.filter(o => completedStatuses.includes(o.status)).forEach(order => {
        const method = order.payment_method_title || order.payment_method || 'N/D';
        if (!paymentMethods[method]) paymentMethods[method] = 0;
        paymentMethods[method]++;
    });

    const sorted = Object.entries(paymentMethods).sort((a, b) => b[1] - a[1]);
    const colors = ['#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4'];

    if (charts.payment) charts.payment.destroy();

    charts.payment = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sorted.map(([method]) => method),
            datasets: [{
                data: sorted.map(([, count]) => count),
                backgroundColor: colors,
                borderWidth: 3,
                borderColor: '#fff',
                borderRadius: 6,
                spacing: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 15,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

// Aggiorna tabelle
function updateTables() {
    updateTopCustomersTable();
}

// Tabella top clienti
function updateTopCustomersTable() {
    const tbody = document.querySelector('#topCustomersTable tbody');
    const completedStatuses = ['completed', 'processing'];

    const customers = {};
    filteredOrders.filter(o => completedStatuses.includes(o.status)).forEach(order => {
        const email = order.customer?.email;
        if (!email) return;

        if (!customers[email]) {
            customers[email] = {
                name: `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim(),
                orders: 0,
                total: 0
            };
        }
        customers[email].orders++;
        customers[email].total += order.total;
    });

    const sorted = Object.entries(customers)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 20);

    tbody.innerHTML = sorted.map(([email, data], i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${data.name || email}</td>
            <td>${data.orders}</td>
            <td>${formatCurrency(data.total)}</td>
        </tr>
    `).join('');
}

// Utility functions
function formatCurrency(value) {
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
    }).format(value);
}

function formatCurrencyShort(value) {
    if (value >= 1000) {
        return (value / 1000).toFixed(1) + 'k';
    }
    return value.toFixed(0);
}

function formatDate(date) {
    return date.toLocaleDateString('it-IT');
}

function formatDateShort(date) {
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

function formatTime(date) {
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function truncate(str, len) {
    return str.length > len ? str.substring(0, len) + '...' : str;
}

function translateStatus(status) {
    const translations = {
        'completed': 'Completato',
        'processing': 'In elaborazione',
        'pending': 'In attesa',
        'on-hold': 'In sospeso',
        'cancelled': 'Annullato',
        'refunded': 'Rimborsato',
        'failed': 'Fallito'
    };
    return translations[status] || status;
}
