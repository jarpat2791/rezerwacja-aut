// Skrypt dla raportów miesięcznych

document.addEventListener('DOMContentLoaded', function() {
    // Sprawdź czy użytkownik jest zalogowany
    const user = JSON.parse(localStorage.getItem('currentUser'));
    
    if (!user || (user.role !== 'admin' && user.login !== 'admin')) {
        alert('Brak uprawnień do przeglądania raportów!');
        window.location.href = 'index.html';
        return;
    }
    
    // Ustaw nazwę użytkownika
    document.getElementById('userDisplay').textContent = `Zalogowany jako: ${user.name}`;
    
    // Ustaw bieżący miesiąc i rok
    const now = new Date();
    document.getElementById('reportMonth').value = now.getMonth() + 1;
    document.getElementById('reportYear').value = now.getFullYear();
    
    // Obsługa przycisków
    document.getElementById('generateReport').addEventListener('click', generateReport);
    document.getElementById('exportReport').addEventListener('click', exportReportToPDF);
    
    // Aktualizuj datę ostatniej aktualizacji
    updateLastUpdate();
    
    // Załaduj dane
    loadReservationsForReport();
});

let currentReport = null;

// Załaduj rezerwacje dla raportu
function loadReservationsForReport() {
    const savedReservations = localStorage.getItem('carReservations');
    if (savedReservations) {
        reservations = JSON.parse(savedReservations);
        
        // Wyczyść stare rezerwacje
        cleanOldReservations();
    }
}

// Generuj raport
function generateReport() {
    const month = parseInt(document.getElementById('reportMonth').value);
    const year = parseInt(document.getElementById('reportYear').value);
    const reportType = document.getElementById('reportType').value;
    
    // Generuj raport
    currentReport = generateMonthlyReport(month, year);
    currentReport.type = reportType;
    currentReport.monthName = getMonthName(month);
    currentReport.year = year;
    
    // Wyświetl raport
    displayReport(currentReport, reportType);
    
    // Aktywuj przycisk eksportu
    document.getElementById('exportReport').disabled = false;
    
    // Ukryj komunikat "brak raportu"
    document.getElementById('noReport').classList.add('hidden');
    document.getElementById('reportResults').classList.remove('hidden');
}

// Wyświetl raport
function displayReport(report, type) {
    const resultsContainer = document.getElementById('reportResults');
    
    switch(type) {
        case 'summary':
            displaySummaryReport(report, resultsContainer);
            break;
        case 'detailed':
            displayDetailedReport(report, resultsContainer);
            break;
        case 'byCar':
            displayByCarReport(report, resultsContainer);
            break;
        case 'byDepartment':
            displayByDepartmentReport(report, resultsContainer);
            break;
        case 'byEmployee':
            displayByEmployeeReport(report, resultsContainer);
            break;
    }
}

// Podsumowanie
function displaySummaryReport(report, container) {
    container.innerHTML = `
        <div class="report-summary">
            <div class="report-card">
                <h4><i class="fas fa-chart-pie"></i> Podsumowanie miesiąca</h4>
                <p class="report-stat">${report.totalReservations}</p>
                <p class="report-label">Łącznie rezerwacji</p>
                <p class="report-stat">${report.totalDays}</p>
                <p class="report-label">Łączna liczba dni</p>
                <p class="report-label">Średnio: ${report.totalReservations > 0 ? (report.totalDays / report.totalReservations).toFixed(1) : 0} dni/rezerwacji</p>
            </div>
            
            <div class="report-card">
                <h4><i class="fas fa-car"></i> Najbardziej popularne auto</h4>
                ${getMostPopularCar(report)}
            </div>
            
            <div class="report-card">
                <h4><i class="fas fa-building"></i> Najaktywniejszy dział</h4>
                ${getMostActiveDepartment(report)}
            </div>
            
            <div class="report-card">
                <h4><i class="fas fa-user"></i> Najaktywniejszy pracownik</h4>
                ${getMostActiveEmployee(report)}
            </div>
        </div>
        
        <div class="report-card" style="margin-top: 30px;">
            <h4><i class="fas fa-calendar-check"></i> Wykorzystanie aut (liczba dni)</h4>
            <div class="car-usage-chart">
                ${generateCarUsageChart(report)}
            </div>
        </div>
    `;
}

// Szczegółowy raport
function displayDetailedReport(report, container) {
    // Pobierz szczegółowe rezerwacje
    const monthReservations = getReservationsForMonth(report.month, report.year);
    
    let reservationsHtml = '';
    if (monthReservations.length > 0) {
        reservationsHtml = `
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Auto</th>
                        <th>Pracownik</th>
                        <th>Dział</th>
                        <th>Liczba dni</th>
                        <th>Cel</th>
                    </tr>
                </thead>
                <tbody>
                    ${monthReservations.map(reservation => `
                        <tr>
                            <td>${formatDate(reservation.startDate)} - ${formatDate(reservation.endDate)}</td>
                            <td>${reservation.carName}</td>
                            <td>${reservation.employeeName}</td>
                            <td>${reservation.department}</td>
                            <td>${reservation.daysCount || calculateDays(reservation.startDate, reservation.endDate)}</td>
                            <td>${reservation.purpose}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <p style="margin-top: 15px; font-size: 14px; color: #666;">
                Łącznie: ${monthReservations.length} rezerwacji
            </p>
        `;
    } else {
        reservationsHtml = '<p class="text-center">Brak rezerwacji w wybranym miesiącu</p>';
    }
    
    container.innerHTML = `
        <div class="report-card">
            <h4><i class="fas fa-list-alt"></i> Szczegółowa lista rezerwacji - ${report.monthName} ${report.year}</h4>
            ${reservationsHtml}
        </div>
    `;
}

// Raport według aut
function displayByCarReport(report, container) {
    let carsHtml = '';
    Object.keys(report.byCar).forEach(carId => {
        const car = CARS.find(c => c.id === carId) || { name: carId };
        const stats = report.byCar[carId];
        const percentage = report.totalDays > 0 ? ((stats.days / report.totalDays) * 100).toFixed(1) : 0;
        
        carsHtml += `
            <tr>
                <td>${car.name}</td>
                <td>${stats.count}</td>
                <td>${stats.days}</td>
                <td>${percentage}%</td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                </td>
            </tr>
        `;
    });
    
    container.innerHTML = `
        <div class="report-card">
            <h4><i class="fas fa-car"></i> Wykorzystanie aut - ${report.monthName} ${report.year}</h4>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Auto</th>
                        <th>Liczba rezerwacji</th>
                        <th>Liczba dni</th>
                        <th>Procent wykorzystania</th>
                        <th>Wykres</th>
                    </tr>
                </thead>
                <tbody>
                    ${carsHtml || '<tr><td colspan="5" class="text-center">Brak danych</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

// Raport według działów
function displayByDepartmentReport(report, container) {
    let departmentsHtml = '';
    Object.keys(report.byDepartment).forEach(dept => {
        const stats = report.byDepartment[dept];
        const percentage = report.totalReservations > 0 ? ((stats.count / report.totalReservations) * 100).toFixed(1) : 0;
        
        departmentsHtml += `
            <tr>
                <td>${dept}</td>
                <td>${stats.count}</td>
                <td>${stats.days}</td>
                <td>${percentage}%</td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                </td>
            </tr>
        `;
    });
    
    container.innerHTML = `
        <div class="report-card">
            <h4><i class="fas fa-building"></i> Rezerwacje według działów - ${report.monthName} ${report.year}</h4>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Dział</th>
                        <th>Liczba rezerwacji</th>
                        <th>Liczba dni</th>
                        <th>Procent udziału</th>
                        <th>Wykres</th>
                    </tr>
                </thead>
                <tbody>
                    ${departmentsHtml || '<tr><td colspan="5" class="text-center">Brak danych</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

// Raport według pracowników
function displayByEmployeeReport(report, container) {
    let employeesHtml = '';
    Object.keys(report.byEmployee).forEach(employee => {
        const stats = report.byEmployee[employee];
        const percentage = report.totalReservations > 0 ? ((stats.count / report.totalReservations) * 100).toFixed(1) : 0;
        
        employeesHtml += `
            <tr>
                <td>${employee}</td>
                <td>${stats.department}</td>
                <td>${stats.count}</td>
                <td>${stats.days}</td>
                <td>${percentage}%</td>
            </tr>
        `;
    });
    
    container.innerHTML = `
        <div class="report-card">
            <h4><i class="fas fa-users"></i> Aktywność pracowników - ${report.monthName} ${report.year}</h4>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Pracownik</th>
                        <th>Dział</th>
                        <th>Liczba rezerwacji</th>
                        <th>Liczba dni</th>
                        <th>Procent udziału</th>
                    </tr>
                </thead>
                <tbody>
                    ${employeesHtml || '<tr><td colspan="5" class="text-center">Brak danych</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

// Eksportuj raport do PDF
function exportReportToPDF() {
    if (!currentReport) {
        alert('Najpierw wygeneruj raport!');
        return;
    }
    
    const reportContent = document.getElementById('reportResults').innerHTML;
    const fullContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Raport rezerwacji - ${currentReport.monthName} ${currentReport.year}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #2a5298; }
                .report-container { margin: 20px 0; }
                table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .progress-bar { width: 100%; height: 20px; background-color: #f0f0f0; border-radius: 3px; }
                .progress-fill { height: 100%; background-color: #2a5298; border-radius: 3px; }
                .report-card { border: 1px solid #ddd; padding: 15px; margin: 15px 0; border-radius: 5px; }
                .report-stat { font-size: 24px; font-weight: bold; color: #2a5298; }
            </style>
        </head>
        <body>
            <h1>Raport rezerwacji aut - ${currentReport.monthName} ${currentReport.year}</h1>
            <p>Typ raportu: ${getReportTypeName(currentReport.type)}</p>
            <p>Wygenerowano: ${new Date().toLocaleString('pl-PL')}</p>
            <div class="report-container">
                ${reportContent}
            </div>
        </body>
        </html>
    `;
    
    exportToPDF(fullContent, `raport-${currentReport.monthName.toLowerCase()}-${currentReport.year}-${currentReport.type}.pdf`);
}

// Funkcje pomocnicze
function getMonthName(month) {
    const monthNames = [
        'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
        'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    return monthNames[month - 1];
}

function getReportTypeName(type) {
    const typeNames = {
        'summary': 'Podsumowanie',
        'detailed': 'Szczegółowy',
        'byCar': 'Według aut',
        'byDepartment': 'Według działów',
        'byEmployee': 'Według pracowników'
    };
    return typeNames[type] || type;
}

function getMostPopularCar(report) {
    let popularCar = null;
    let maxDays = 0;
    
    Object.keys(report.byCar).forEach(carId => {
        if (report.byCar[carId].days > maxDays) {
            maxDays = report.byCar[carId].days;
            popularCar = carId;
        }
    });
    
    if (popularCar) {
        const car = CARS.find(c => c.id === popularCar) || { name: popularCar };
        return `
            <p class="report-stat">${car.name}</p>
            <p class="report-label">${maxDays} dni (${report.byCar[popularCar].count} rezerwacji)</p>
        `;
    }
    
    return '<p class="report-label">Brak danych</p>';
}

function getMostActiveDepartment(report) {
    let activeDept = null;
    let maxReservations = 0;
    
    Object.keys(report.byDepartment).forEach(dept => {
        if (report.byDepartment[dept].count > maxReservations) {
            maxReservations = report.byDepartment[dept].count;
            activeDept = dept;
        }
    });
    
    if (activeDept) {
        return `
            <p class="report-stat">${activeDept}</p>
            <p class="report-label">${maxReservations} rezerwacji (${report.byDepartment[activeDept].days} dni)</p>
        `;
    }
    
    return '<p class="report-label">Brak danych</p>';
}

function getMostActiveEmployee(report) {
    let activeEmployee = null;
    let maxReservations = 0;
    
    Object.keys(report.byEmployee).forEach(employee => {
        if (report.byEmployee[employee].count > maxReservations) {
            maxReservations = report.byEmployee[employee].count;
            activeEmployee = employee;
        }
    });
    
    if (activeEmployee) {
        return `
            <p class="report-stat">${activeEmployee}</p>
            <p class="report-label">${maxReservations} rezerwacji (${report.byEmployee[activeEmployee].days} dni)</p>
            <p class="report-label">Dział: ${report.byEmployee[activeEmployee].department}</p>
        `;
    }
    
    return '<p class="report-label">Brak danych</p>';
}

function generateCarUsageChart(report) {
    let chartHtml = '';
    Object.keys(report.byCar).forEach(carId => {
        const car = CARS.find(c => c.id === carId) || { name: carId };
        const stats = report.byCar[carId];
        const percentage = report.totalDays > 0 ? ((stats.days / report.totalDays) * 100).toFixed(1) : 0;
        
        chartHtml += `
            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>${car.name}</span>
                    <span>${stats.days} dni (${percentage}%)</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%; background-color: ${getColorForCar(carId)};"></div>
                </div>
            </div>
        `;
    });
    
    return chartHtml || '<p>Brak danych o wykorzystaniu aut</p>';
}

function getColorForCar(carId) {
    const colors = [
        '#2a5298', '#e74c3c', '#27ae60', '#f39c12', 
        '#9b59b6', '#1abc9c', '#d35400', '#34495e'
    ];
    const index = CARS.findIndex(c => c.id === carId);
    return colors[index % colors.length] || '#2a5298';
}

function getReservationsForMonth(month, year) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    return reservations.filter(r => {
        const resDate = new Date(r.startDate);
        return resDate >= startDate && resDate <= endDate && r.status !== 'cancelled';
    });
}

function calculateDays(startDateStr, endDateStr) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL');
}

function updateLastUpdate() {
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (lastUpdateElement) {
        lastUpdateElement.textContent = `Ostatnia aktualizacja: ${new Date().toLocaleString('pl-PL')}`;
    }
}

// Progress bar styles
const style = document.createElement('style');
style.textContent = `
    .progress-bar {
        width: 100%;
        height: 8px;
        background-color: #f0f0f0;
        border-radius: 4px;
        overflow: hidden;
    }
    .progress-fill {
        height: 100%;
        background-color: #2a5298;
        border-radius: 4px;
        transition: width 0.3s;
    }
`;
document.head.appendChild(style);