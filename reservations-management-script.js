// Zmienne globalne dla zarządzania rezerwacjami
let allReservations = [];
let filteredReservations = [];
let currentPage = 1;
const itemsPerPage = 10;
let flatpickrFilterInstance = null;
let flatpickrEditInstance = null;
let currentReservationIdToDelete = null;

// Inicjalizacja strony zarządzania rezerwacjami
document.addEventListener('DOMContentLoaded', function() {
    // Sprawdź czy użytkownik jest zalogowany i jest administratorem
    const user = getCurrentUser();
    
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    if (user.role !== 'admin' && user.login !== 'admin') {
        window.location.href = 'index.html';
        return;
    }
    
    // Ustaw nazwę użytkownika
    document.getElementById('username').textContent = user.name;
    
    // Inicjalizuj komponenty
    initFilters();
    loadReservationsData();
    setupEventListeners();
    updateStats();
    
    // Obsługa wylogowania
    if (document.getElementById('logoutBtn')) {
        document.getElementById('logoutBtn').addEventListener('click', function() {
            clearCurrentUser();
            window.location.href = 'login.html';
        });
    }
});

// Inicjalizacja filtrów
function initFilters() {
    // Inicjalizuj kalendarz filtrowania
    flatpickrFilterInstance = flatpickr("#filterDate", {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: "pl",
        allowInput: false,
        altInput: true,
        altFormat: "d.m.Y",
        ariaDateFormat: "d.m.Y"
    });
    
    // Inicjalizuj kalendarz edycji
    flatpickrEditInstance = flatpickr("#editReservationDates", {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: "pl",
        minDate: "today",
        maxDate: new Date().fp_incr(90),
        allowInput: false,
        altInput: true,
        altFormat: "d.m.Y",
        ariaDateFormat: "d.m.Y"
    });
}

// Ładowanie danych rezerwacji
function loadReservationsData() {
    // Pobierz dane z localStorage
    const savedReservations = localStorage.getItem('carReservations');
    
    if (savedReservations) {
        allReservations = JSON.parse(savedReservations);
        
        // Dodaj pole "completed" dla rezerwacji z przeszłości
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        allReservations = allReservations.map(reservation => {
            const endDate = parseLocalDate(reservation.endDate);
            const isCompleted = endDate < today && reservation.status === 'active';
            
            return {
                ...reservation,
                displayStatus: isCompleted ? 'completed' : reservation.status
            };
        });
        
        // Zastosuj domyślne filtry
        applyFilters();
    } else {
        allReservations = [];
        filteredReservations = [];
        updateReservationsTable();
    }
}

// Ustawienie nasłuchiwania zdarzeń
function setupEventListeners() {
    // Filtry
    document.getElementById('applyFilters').addEventListener('click', function() {
        applyFilters();
    });
    
    document.getElementById('resetFilters').addEventListener('click', function() {
        resetFilters();
    });
    
    // Eksport
    document.getElementById('exportExcel').addEventListener('click', function() {
        exportToExcel();
    });
    
    document.getElementById('exportPDF').addEventListener('click', function() {
        exportToPDF();
    });
    
    document.getElementById('refreshList').addEventListener('click', function() {
        loadReservationsData();
    });
    
    // Paginacja
    document.getElementById('prevPage').addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            updateReservationsTable();
            updatePagination();
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', function() {
        const totalPages = Math.ceil(filteredReservations.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            updateReservationsTable();
            updatePagination();
        }
    });
    
    // Modal edycji
    const editModal = document.getElementById('editModal');
    const closeEditModal = document.querySelectorAll('.close-modal');
    const closeConfirmModal = document.querySelectorAll('.close-confirm-modal');
    
    closeEditModal.forEach(btn => {
        btn.addEventListener('click', function() {
            editModal.style.display = 'none';
        });
    });
    
    closeConfirmModal.forEach(btn => {
        btn.addEventListener('click', function() {
            document.getElementById('confirmModal').style.display = 'none';
        });
    });
    
    // Zamykanie modali po kliknięciu poza
    window.addEventListener('click', function(event) {
        const editModal = document.getElementById('editModal');
        const confirmModal = document.getElementById('confirmModal');
        
        if (event.target === editModal) {
            editModal.style.display = 'none';
        }
        
        if (event.target === confirmModal) {
            confirmModal.style.display = 'none';
        }
    });
    
    // Formularz edycji
    document.getElementById('editReservationForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveReservationChanges();
    });
    
    // Potwierdzenie modal
    document.getElementById('confirmYes').addEventListener('click', function() {
        if (currentReservationIdToDelete) {
            deleteReservation(currentReservationIdToDelete);
            currentReservationIdToDelete = null;
        }
        document.getElementById('confirmModal').style.display = 'none';
    });
    
    document.getElementById('confirmNo').addEventListener('click', function() {
        currentReservationIdToDelete = null;
        document.getElementById('confirmModal').style.display = 'none';
    });
}

// Zastosowanie filtrów
function applyFilters() {
    const carFilter = document.getElementById('filterCar').value;
    const statusFilter = document.getElementById('filterStatus').value;
    const employeeFilter = document.getElementById('filterEmployee').value.toLowerCase();
    const dateFilter = flatpickrFilterInstance.selectedDates;
    
    filteredReservations = allReservations.filter(reservation => {
        // Filtruj po aucie
        if (carFilter && reservation.carId !== carFilter) {
            return false;
        }
        
        // Filtruj po statusie
        if (statusFilter && reservation.displayStatus !== statusFilter) {
            return false;
        }
        
        // Filtruj po pracowniku
        if (employeeFilter && !reservation.employeeName.toLowerCase().includes(employeeFilter)) {
            return false;
        }
        
        // Filtruj po dacie
        if (dateFilter && dateFilter.length === 2) {
            const startFilter = getDateOnly(dateFilter[0]);
            const endFilter = getDateOnly(dateFilter[1]);
            
            const startReservation = parseLocalDate(reservation.startDate);
            const endReservation = parseLocalDate(reservation.endDate);
            
            // Sprawdź czy rezerwacja nakłada się z filtrem dat
            if (!(endReservation >= startFilter && startReservation <= endFilter)) {
                return false;
            }
        }
        
        return true;
    });
    
    // Sortuj od najnowszych
    filteredReservations.sort((a, b) => {
        const dateA = parseLocalDate(a.bookingDate || a.startDate);
        const dateB = parseLocalDate(b.bookingDate || b.startDate);
        return dateB - dateA;
    });
    
    currentPage = 1;
    updateReservationsTable();
    updatePagination();
    updateStats();
}

// Resetowanie filtrów
function resetFilters() {
    document.getElementById('filterCar').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterEmployee').value = '';
    flatpickrFilterInstance.clear();
    
    applyFilters();
}

// Aktualizacja tabeli rezerwacji
function updateReservationsTable() {
    const tableBody = document.getElementById('reservationsTableBody');
    const totalElement = document.getElementById('totalReservations');
    
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (filteredReservations.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="8" style="text-align: center; padding: 20px;">
                <i class="fas fa-info-circle" style="font-size: 24px; color: #3498db; margin-bottom: 10px; display: block;"></i>
                <p>Brak rezerwacji spełniających kryteria wyszukiwania</p>
            </td>
        `;
        tableBody.appendChild(row);
        totalElement.textContent = '0';
        return;
    }
    
    // Oblicz zakres dla paginacji
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredReservations.length);
    const pageReservations = filteredReservations.slice(startIndex, endIndex);
    
    totalElement.textContent = filteredReservations.length;
    
    pageReservations.forEach((reservation, index) => {
        const row = document.createElement('tr');
        
        // Określ status
        const statusClass = getStatusClass(reservation.displayStatus || reservation.status);
        const statusText = getStatusText(reservation.displayStatus || reservation.status);
        
        // Znajdź nazwę auta
        const car = CARS.find(c => c.id === reservation.carId);
        const carName = car ? `${car.name} (${car.plate})` : reservation.carId;
        
        row.innerHTML = `
            <td>${reservation.id.substring(0, 8)}...</td>
            <td>${carName}</td>
            <td>${reservation.employeeName}</td>
            <td>${reservation.department}</td>
            <td>
                <div class="date-range">
                    <div><i class="fas fa-calendar-day"></i> ${formatDate(reservation.startDate)}</div>
                    <div><i class="fas fa-calendar-day"></i> ${formatDate(reservation.endDate)}</div>
                    <div class="days-count">(${reservation.daysCount || 1} dni)</div>
                </div>
            </td>
            <td class="purpose-cell">${reservation.purpose}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit-small" onclick="editReservation('${reservation.id}')" title="Edytuj">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete-small" onclick="confirmDeleteReservation('${reservation.id}')" title="Usuń">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn-info-small" onclick="showReservationDetails('${reservation.id}')" title="Szczegóły">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Aktualizacja paginacji
function updatePagination() {
    const totalPages = Math.ceil(filteredReservations.length / itemsPerPage);
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    const pageNumbers = document.getElementById('pageNumbers');
    
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages || totalPages === 0;
    
    pageNumbers.innerHTML = '';
    
    if (totalPages === 0) {
        pageNumbers.innerHTML = '<span>Strona 0 z 0</span>';
        return;
    }
    
    // Wyświetl maksymalnie 5 numerów stron
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = `page-number ${i === currentPage ? 'active' : ''}`;
        pageButton.textContent = i;
        pageButton.addEventListener('click', function() {
            currentPage = i;
            updateReservationsTable();
            updatePagination();
        });
        pageNumbers.appendChild(pageButton);
    }
    
    if (totalPages > 1) {
        pageNumbers.innerHTML += `<span class="page-info">Strona ${currentPage} z ${totalPages}</span>`;
    }
}

// Aktualizacja statystyk
function updateStats() {
    const activeCount = allReservations.filter(r => r.status === 'active').length;
    const cancelledCount = allReservations.filter(r => r.status === 'cancelled').length;
    
    // Unikalne auta z rezerwacjami
    const carsWithReservations = new Set(allReservations.filter(r => r.status === 'active').map(r => r.carId)).size;
    
    // Unikalni aktywni użytkownicy
    const activeUsers = new Set(allReservations.filter(r => r.status === 'active').map(r => r.login)).size;
    
    document.getElementById('activeCount').textContent = activeCount;
    document.getElementById('cancelledCount').textContent = cancelledCount;
    document.getElementById('carsWithReservations').textContent = carsWithReservations;
    document.getElementById('activeUsers').textContent = activeUsers;
}

// Edycja rezerwacji
function editReservation(reservationId) {
    const reservation = allReservations.find(r => r.id === reservationId);
    if (!reservation) return;
    
    // Wypełnij formularz edycji
    document.getElementById('editReservationId').value = reservation.id;
    document.getElementById('editEmployeeName').value = reservation.employeeName;
    document.getElementById('editEmployeeDepartment').value = reservation.department;
    document.getElementById('editCarSelect').value = reservation.carId;
    document.getElementById('editPurpose').value = reservation.purpose;
    document.getElementById('editStatus').value = reservation.status;
    
    // Ustaw daty w kalendarzu edycji
    const startDate = parseLocalDate(reservation.startDate);
    const endDate = parseLocalDate(reservation.endDate);
    
    if (startDate && endDate && flatpickrEditInstance) {
        flatpickrEditInstance.setDate([startDate, endDate], false);
    }
    
    // Pokaż modal
    document.getElementById('editModal').style.display = 'flex';
}

// Zapis zmian w rezerwacji
function saveReservationChanges() {
    const reservationId = document.getElementById('editReservationId').value;
    const index = allReservations.findIndex(r => r.id === reservationId);
    
    if (index === -1) {
        showMessage('message', 'Rezerwacja nie została znaleziona', 'error');
        return;
    }
    
    const selectedDates = flatpickrEditInstance ? flatpickrEditInstance.selectedDates : [];
    
    if (selectedDates.length !== 2) {
        showMessage('editModal', 'Wybierz zakres dat (kliknij dzień rozpoczęcia i zakończenia)', 'error');
        return;
    }
    
    const startDate = selectedDates[0];
    const endDate = selectedDates[1];
    const normalizedStart = getDateOnly(startDate);
    const normalizedEnd = getDateOnly(endDate);
    
    const diffTime = normalizedEnd.getTime() - normalizedStart.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    if (diffDays > 7) {
        showMessage('editModal', 'Możesz zarezerwować auto maksymalnie na 7 dni', 'error');
        return;
    }
    
    // Sprawdź dostępność auta (wykluczając bieżącą rezerwację)
    const carId = document.getElementById('editCarSelect').value;
    const isAvailable = checkCarAvailability(carId, normalizedStart, normalizedEnd, reservationId);
    
    if (!isAvailable.available) {
        showMessage('editModal', `Auto jest już zarezerwowane w tym terminie! Konflikt: ${isAvailable.conflictInfo}`, 'error');
        return;
    }
    
    // Aktualizuj rezerwację
    allReservations[index] = {
        ...allReservations[index],
        employeeName: document.getElementById('editEmployeeName').value,
        department: document.getElementById('editEmployeeDepartment').value,
        carId: carId,
        carName: CARS.find(c => c.id === carId)?.name || carId,
        startDate: formatDateForStorage(normalizedStart),
        endDate: formatDateForStorage(normalizedEnd),
        purpose: document.getElementById('editPurpose').value,
        status: document.getElementById('editStatus').value,
        daysCount: diffDays
    };
    
    // Zapisz do localStorage
    saveReservationsToStorage();
    
    // Odśwież dane
    loadReservationsData();
    
    // Zamknij modal i pokaż komunikat sukcesu
    document.getElementById('editModal').style.display = 'none';
    showNotification('Rezerwacja została zaktualizowana pomyślnie!', 'success');
}

// Potwierdzenie usunięcia rezerwacji
function confirmDeleteReservation(reservationId) {
    currentReservationIdToDelete = reservationId;
    const reservation = allReservations.find(r => r.id === reservationId);
    
    if (reservation) {
        document.getElementById('confirmMessage').textContent = 
            `Czy na pewno chcesz trwale usunąć rezerwację ${reservationId.substring(0, 8)}...?`;
    }
    
    document.getElementById('confirmModal').style.display = 'flex';
}

// Usuwanie rezerwacji
function deleteReservation(reservationId) {
    const index = allReservations.findIndex(r => r.id === reservationId);
    
    if (index !== -1) {
        allReservations.splice(index, 1);
        
        // Zapisz do localStorage
        saveReservationsToStorage();
        
        // Odśwież dane
        loadReservationsData();
        
        showNotification('Rezerwacja została usunięta pomyślnie!', 'success');
    }
}

// Pokazanie szczegółów rezerwacji
function showReservationDetails(reservationId) {
    const reservation = allReservations.find(r => r.id === reservationId);
    if (!reservation) return;
    
    const car = CARS.find(c => c.id === reservation.carId);
    const carName = car ? `${car.name} (${car.plate})` : reservation.carId;
    
    const detailsHtml = `
        <h3>Szczegóły rezerwacji</h3>
        <div class="reservation-details">
            <div class="detail-item">
                <strong>ID rezerwacji:</strong> ${reservation.id}
            </div>
            <div class="detail-item">
                <strong>Auto:</strong> ${carName}
            </div>
            <div class="detail-item">
                <strong>Pracownik:</strong> ${reservation.employeeName}
            </div>
            <div class="detail-item">
                <strong>Dział:</strong> ${reservation.department}
            </div>
            <div class="detail-item">
                <strong>Okres rezerwacji:</strong> ${formatDate(reservation.startDate)} - ${formatDate(reservation.endDate)}
            </div>
            <div class="detail-item">
                <strong>Liczba dni:</strong> ${reservation.daysCount || 1}
            </div>
            <div class="detail-item">
                <strong>Cel wyjazdu:</strong> ${reservation.purpose}
            </div>
            <div class="detail-item">
                <strong>Data rezerwacji:</strong> ${formatDate(reservation.bookingDate || reservation.startDate)}
            </div>
            <div class="detail-item">
                <strong>Status:</strong> <span class="status-badge ${getStatusClass(reservation.status)}">${getStatusText(reservation.status)}</span>
            </div>
            ${reservation.cancelledDate ? `
                <div class="detail-item">
                    <strong>Data anulowania:</strong> ${formatDate(reservation.cancelledDate)}
                </div>
                <div class="detail-item">
                    <strong>Anulowane przez:</strong> ${reservation.cancelledBy || 'Nieznany'}
                </div>
            ` : ''}
        </div>
    `;
    
    // Utwórz modal z szczegółami
    const detailsModal = document.createElement('div');
    detailsModal.className = 'modal';
    detailsModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 10px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
    `;
    
    modalContent.innerHTML = `
        <div class="modal-header">
            <h3><i class="fas fa-info-circle"></i> Szczegóły rezerwacji</h3>
            <span class="close-details-modal" style="cursor: pointer; font-size: 24px;">&times;</span>
        </div>
        <div class="modal-body">
            ${detailsHtml}
            <div class="modal-buttons" style="margin-top: 20px;">
                <button class="btn-submit close-details-modal">Zamknij</button>
            </div>
        </div>
    `;
    
    detailsModal.appendChild(modalContent);
    document.body.appendChild(detailsModal);
    
    // Obsługa zamknięcia modala
    const closeButtons = modalContent.querySelectorAll('.close-details-modal');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            document.body.removeChild(detailsModal);
        });
    });
    
    // Zamknięcie po kliknięciu poza modalem
    detailsModal.addEventListener('click', function(event) {
        if (event.target === detailsModal) {
            document.body.removeChild(detailsModal);
        }
    });
}

// Eksport do Excel
function exportToExcel() {
    if (filteredReservations.length === 0) {
        showNotification('Brak danych do eksportu', 'warning');
        return;
    }
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + "ID,Auto,Pracownik,Dział,Data rozpoczęcia,Data zakończenia,Liczba dni,Cel wyjazdu,Status,Data rezerwacji\n"
        + filteredReservations.map(reservation => {
            const car = CARS.find(c => c.id === reservation.carId);
            const carName = car ? car.name : reservation.carId;
            
            return `"${reservation.id}","${carName}","${reservation.employeeName}","${reservation.department}",` +
                   `"${formatDate(reservation.startDate)}","${formatDate(reservation.endDate)}",` +
                   `"${reservation.daysCount || 1}","${reservation.purpose}",` +
                   `"${getStatusText(reservation.displayStatus || reservation.status)}",` +
                   `"${formatDate(reservation.bookingDate || reservation.startDate)}"`;
        }).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rezerwacje_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`Wyeksportowano ${filteredReservations.length} rezerwacji do pliku CSV`, 'success');
}

// Eksport do PDF
function exportToPDF() {
    if (filteredReservations.length === 0) {
        showNotification('Brak danych do eksportu', 'warning');
        return;
    }
    
    // Użyj funkcji exportReservationsToPDF z głównego skryptu
    exportReservationsToPDF();
}

// Pomocnicze funkcje
function getStatusClass(status) {
    switch(status) {
        case 'active': return 'status-active';
        case 'cancelled': return 'status-cancelled';
        case 'completed': return 'status-completed';
        default: return 'status-unknown';
    }
}

function getStatusText(status) {
    switch(status) {
        case 'active': return 'Aktywna';
        case 'cancelled': return 'Anulowana';
        case 'completed': return 'Zakończona';
        default: return status;
    }
}

function showNotification(message, type = 'info') {
    // Sprawdź czy już istnieje powiadomienie
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        document.body.removeChild(existingNotification);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Automatyczne ukrycie po 5 sekundach
    setTimeout(() => {
        if (notification.parentNode) {
            document.body.removeChild(notification);
        }
    }, 5000);
}

// Funkcja do zapisu rezerwacji (z głównego skryptu)
function saveReservationsToStorage() {
    localStorage.setItem('carReservations', JSON.stringify(allReservations));
}

// Eksport funkcji do globalnego zakresu
window.editReservation = editReservation;
window.confirmDeleteReservation = confirmDeleteReservation;
window.showReservationDetails = showReservationDetails;
