// Dane logowania (w rzeczywistości należy użyć bezpiecznego systemu uwierzytelniania)
const VALID_USERS = [
    { login: "pracownik1", password: "haslo123", name: "Jan Kowalski", role: "user", email: "jan.kowalski@firma.pl" },
    { login: "pracownik2", password: "haslo456", name: "Anna Nowak", role: "user", email: "anna.nowak@firma.pl" },
    { login: "pracownik3", password: "haslo789", name: "Piotr Wiśniewski", role: "user", email: "piotr.wisniewski@firma.pl" },
    { login: "admin", password: "admin123", name: "Administrator", role: "admin", email: "admin@firma.pl" }
];

// Dane aut
const CARS = [
    { id: "Auto1", name: "Skoda Octavia 1", plate: "RZ 12345" },
    { id: "Auto2", name: "Skoda Octavia 2", plate: "RZ 23456" },
    { id: "Auto3", name: "Skoda Octavia 3", plate: "RZ 34567"},
    { id: "Auto4", name: "Skoda Superb", plate: "RZ 45678"},
    { id: "Auto5", name: "Hyundai Tucson 1", plate: "RZ 56789" },
    { id: "Auto6", name: "Hyundai Tucson 2", plate: "RZ 67890" }
];

// URL Google Apps Script (do zastąpienia własnym)
const GOOGLE_SCRIPT_URL = "TUTAJ_WPISZ_URL_TWOJEGO_GOOGLE_APPS_SCRIPT";

// Zmienne globalne
let currentUser = null;
let selectedCar = null;
let flatpickrInstance = null;
let reservations = [];
let editingReservationId = null;
let monthCalendarInstance = null;

// ===== FUNKCJE POMOCNICZE =====
function getCurrentUser() {
    return JSON.parse(localStorage.getItem('currentUser'));
}

function setCurrentUser(user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
    currentUser = user;
}

function clearCurrentUser() {
    localStorage.removeItem('currentUser');
    currentUser = null;
}

function showMessage(elementId, message, type = "info") {
    const messageElement = document.getElementById(elementId);
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = `message ${type}`;
        messageElement.style.display = 'block';
        
        if (type === "success") {
            setTimeout(() => {
                messageElement.style.display = 'none';
            }, 5000);
        }
    }
}

function generateReservationId() {
    return 'RES-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Funkcja do automatycznego czyszczenia starych rezerwacji
function cleanOldReservations() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const initialLength = reservations.length;
    reservations = reservations.filter(reservation => {
        const reservationDate = new Date(reservation.endDate);
        return reservationDate >= sixMonthsAgo;
    });
    
    if (initialLength !== reservations.length) {
        saveReservationsToStorage();
        console.log(`Usunięto ${initialLength - reservations.length} starych rezerwacji (starszych niż 6 miesięcy)`);
    }
}

// ===== OBSŁUGA LOGOWANIA =====
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const login = document.getElementById('login').value;
        const password = document.getElementById('password').value;
        
        // Najpierw sprawdź w localStorage (jeśli istnieją zaktualizowane dane)
        let user = null;
        const savedUsers = localStorage.getItem('systemUsers');
        
        if (savedUsers) {
            const users = JSON.parse(savedUsers);
            user = users.find(u => u.login === login && u.password === password);
        }
        
        // Jeśli nie znaleziono w localStorage, sprawdź domyślną listę
        if (!user) {
            user = VALID_USERS.find(u => u.login === login && u.password === password);
        }
        
        if (user) {
            setCurrentUser(user);
            
            // Wyczyść stare rezerwacje przy logowaniu
            cleanOldReservations();
            
            window.location.href = 'index.html';
        } else {
            showMessage('loginMessage', 'Nieprawidłowy login lub hasło', 'error');
        }
    });
}

// ===== INICJALIZACJA GŁÓWNEJ STRONY =====
if (document.getElementById('employeeName')) {
    document.addEventListener('DOMContentLoaded', function() {
        // Sprawdź czy użytkownik jest zalogowany
        const user = getCurrentUser();
        
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        // Sprawdź czy jest ustawiony parametr edycji rezerwacji
        const editReservationId = localStorage.getItem('editReservationId');
        if (editReservationId) {
            // Znajdź rezerwację
            const reservationToEdit = reservations.find(r => r.id === editReservationId);
            if (reservationToEdit) {
                // Ustaw opóźnienie, aby formularz się załadował
                setTimeout(() => {
                    editUserReservation(editReservationId);
                }, 500);
            }
            // Wyczyść parametr
            localStorage.removeItem('editReservationId');
        }
        
        // Ustaw informacje o użytkowniku
        document.getElementById('username').textContent = user.name;
        document.getElementById('employeeName').value = user.name;
        
        // Dodaj linki dla administratora
        if (user.role === 'admin' || user.login === 'admin') {
            addAdminLinks(user);
        }
        
        // Dodaj link do zmiany hasła dla wszystkich użytkowników
        addPasswordChangeLink();
        
        // Inicjalizuj kalendarz rezerwacji
        initReservationCalendar();
        
        // Załaduj rezerwacje
        loadReservations();
        
        // Obsługa zmiany wyboru auta
        document.getElementById('carSelect').addEventListener('change', function() {
            selectedCar = this.value;
            const calendarSection = document.getElementById('calendarSection');
            
            if (selectedCar) {
                calendarSection.classList.remove('hidden');
                updateCalendarAvailability();
            } else {
                calendarSection.classList.add('hidden');
            }
        });
        
        // Obsługa formularza rezerwacji
        document.getElementById('reservationForm').addEventListener('submit', function(e) {
            e.preventDefault();
            submitReservation();
        });
        
        // Obsługa wylogowania
        if (document.getElementById('logoutBtn')) {
            document.getElementById('logoutBtn').addEventListener('click', function() {
                clearCurrentUser();
                window.location.href = 'login.html';
            });
        }
        
        // Załaduj dane z Google Sheets (symulacja)
        loadDataFromGoogleSheets();
        
        // Inicjalizuj kalendarz miesiąca jeśli istnieje
        if (document.getElementById('monthCalendar')) {
            initMonthCalendar();
        }
    });
}

// ===== FUNKCJE DODAWANIA LINKÓW =====
function addPasswordChangeLink() {
    const userInfo = document.querySelector('.user-info');
    if (userInfo) {
        // Sprawdź czy link już istnieje
        if (!userInfo.querySelector('.password-change-link')) {
            const passwordLink = document.createElement('div');
            passwordLink.className = 'password-change-link';
            passwordLink.innerHTML = `
                <a href="change-password.html"><i class="fas fa-key"></i> Zmień hasło</a>
            `;
            userInfo.appendChild(passwordLink);
        }
    }
}

function addAdminLinks(user) {
    const userInfo = document.querySelector('.user-info');
    if (!userInfo) return;
    
    // Dodaj link do panelu administracyjnego
    if (!userInfo.querySelector('a[href="admin.html"]')) {
        const adminLink = document.createElement('a');
        adminLink.href = 'admin.html';
        adminLink.innerHTML = '<i class="fas fa-user-cog"></i> Panel administracyjny';
        adminLink.className = 'btn-admin';
        adminLink.style.marginLeft = '10px';
        adminLink.style.padding = '8px 15px';
        adminLink.style.fontSize = '14px';
        userInfo.appendChild(adminLink);
    }
    
    // Dodaj link do zarządzania rezerwacjami
    if (!userInfo.querySelector('a[href="reservations-management.html"]')) {
        const reservationsLink = document.createElement('a');
        reservationsLink.href = 'reservations-management.html';
        reservationsLink.innerHTML = '<i class="fas fa-calendar-alt"></i> Zarządzaj rezerwacjami';
        reservationsLink.className = 'btn-admin';
        reservationsLink.style.marginLeft = '10px';
        reservationsLink.style.padding = '8px 15px';
        reservationsLink.style.fontSize = '14px';
        reservationsLink.style.backgroundColor = '#9b59b6';
        userInfo.appendChild(reservationsLink);
    }
    
    // Dodaj link do kalendarza miesiąca
    if (!userInfo.querySelector('a[href="month-calendar.html"]')) {
        const calendarLink = document.createElement('a');
        calendarLink.href = 'month-calendar.html';
        calendarLink.innerHTML = '<i class="fas fa-calendar-alt"></i> Kalendarz miesiąca';
        calendarLink.className = 'btn-admin';
        calendarLink.style.marginLeft = '10px';
        calendarLink.style.padding = '8px 15px';
        calendarLink.style.fontSize = '14px';
        calendarLink.style.backgroundColor = '#3498db';
        userInfo.appendChild(calendarLink);
    }
    
    // Dodaj link do raportów miesięcznych
    if (!userInfo.querySelector('a[href="monthly-reports.html"]')) {
        const reportsLink = document.createElement('a');
        reportsLink.href = 'monthly-reports.html';
        reportsLink.innerHTML = '<i class="fas fa-chart-bar"></i> Raporty miesięczne';
        reportsLink.className = 'btn-admin';
        reportsLink.style.marginLeft = '10px';
        reportsLink.style.padding = '8px 15px';
        reportsLink.style.fontSize = '14px';
        reportsLink.style.backgroundColor = '#e67e22';
        userInfo.appendChild(reportsLink);
    }
}

// ... (pozostały kod bez zmian) ...

// ===== KALENDARZ REZERWACJI =====
function initReservationCalendar() {
    if (!document.getElementById('reservationDates')) return;
    
    flatpickrInstance = flatpickr("#reservationDates", {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: "pl",
        minDate: "today",
        maxDate: new Date().fp_incr(90),
        disableMobile: true,
        allowInput: false,
        clickOpens: true,
        // DODAJ TE USTAWIENIA:
        time_24hr: true,
        onReady: function(selectedDates, dateStr, instance) {
            instance.set('altInput', true);
            instance.set('altFormat', 'd.m.Y');
        },
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                const startDate = selectedDates[0];
                const endDate = selectedDates[1];
                const diffTime = Math.abs(endDate - startDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                
                if (diffDays > 7) {
                    showMessage('message', 'Możesz zarezerwować auto maksymalnie na 7 dni', 'error');
                    instance.clear();
                    return;
                }
                
                // POPRAWIONE: Użyj formatowania z uwzględnieniem strefy czasowej
                const formattedStart = formatDateForDisplay(startDate);
                const formattedEnd = formatDateForDisplay(endDate);
                console.log('Wybrane daty:', formattedStart, 'do', formattedEnd);
                
                // Ustaw wartość pola z poprawnym formatowaniem
                instance.input.value = `${formattedStart} do ${formattedEnd}`;
            } else if (selectedDates.length === 1) {
                // Jeśli wybrano tylko jeden dzień
                const selectedDate = selectedDates[0];
                const formattedDate = formatDateForDisplay(selectedDate);
                instance.input.value = `${formattedDate} (kliknij ponownie ten sam dzień dla rezerwacji 1-dniowej)`;
            }
        },
        onClose: function(selectedDates, dateStr, instance) {
            // POPRAWIONE: Zapewnij poprawny format po zamknięciu
            if (selectedDates.length === 2) {
                const startDate = selectedDates[0];
                const endDate = selectedDates[1];
                const formattedStart = formatDateForDisplay(startDate);
                const formattedEnd = formatDateForDisplay(endDate);
                instance.input.value = `${formattedStart} do ${formattedEnd}`;
            } else if (selectedDates.length === 1) {
                // Dla rezerwacji 1-dniowej
                const singleDate = selectedDates[0];
                instance.setDate([singleDate, singleDate], true);
                const formattedDate = formatDateForDisplay(singleDate);
                instance.input.value = `${formattedDate} (1 dzień)`;
            }
        }
    });
}

// NOWA FUNKCJA: Formatowanie daty z uwzględnieniem strefy czasowej
function formatDateForDisplay(date) {
    // Użyj lokalnej strefy czasowej
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}.${month}.${year}`;
}

// ZMIENIONA FUNKCJA: Zatwierdzanie rezerwacji
function submitReservation() {
    const user = getCurrentUser();
    if (!user) return;
    
    const selectedDates = flatpickrInstance ? flatpickrInstance.selectedDates : [];
    
    if (!selectedCar) {
        showMessage('message', 'Wybierz auto', 'error');
        return;
    }
    
    if (selectedDates.length !== 2) {
        showMessage('message', 'Wybierz zakres dat', 'error');
        return;
    }
    
    const startDate = selectedDates[0];
    const endDate = selectedDates[1];
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    if (diffDays > 7) {
        showMessage('message', 'Możesz zarezerwować auto maksymalnie na 7 dni', 'error');
        return;
    }
    
    // Sprawdź dostępność auta
    const carReservations = reservations.filter(r => 
        r.carId === selectedCar && 
        r.id !== editingReservationId && 
        r.status !== 'cancelled'
    );
    
    const isAvailable = carReservations.every(reservation => {
        const resStart = new Date(reservation.startDate);
        const resEnd = new Date(reservation.endDate);
        
        return (endDate < resStart) || (startDate > resEnd);
    });
    
    if (!isAvailable) {
        showMessage('message', 'Auto jest już zarezerwowane w wybranym okresie', 'error');
        return;
    }
    
    // POPRAWIONE: Zapewnij poprawny format dat
    const startDateStr = formatDateForStorage(startDate);
    const endDateStr = formatDateForStorage(endDate);
    
    // Przygotuj dane rezerwacji
    const reservationData = {
        id: editingReservationId || generateReservationId(),
        carId: selectedCar,
        carName: CARS.find(c => c.id === selectedCar)?.name || selectedCar,
        employeeName: document.getElementById('employeeName').value,
        department: document.getElementById('employeeDepartment').value,
        startDate: startDateStr, // Użyj poprawionego formatu
        endDate: endDateStr,     // Użyj poprawionego formatu
        purpose: document.getElementById('purpose').value,
        bookingDate: new Date().toISOString().split('T')[0],
        login: editingReservationId ? reservations.find(r => r.id === editingReservationId)?.login : user.login,
        status: 'active',
        daysCount: diffDays
    };
    
    // ... (reszta funkcji bez zmian) ...
}

// NOWA FUNKCJA: Formatowanie daty do przechowywania
function formatDateForStorage(date) {
    // Zawsze zapisuj jako YYYY-MM-DD w lokalnej strefie czasowej
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ZMIENIONA FUNKCJA: Formatowanie daty do wyświetlania
function formatDate(dateString) {
    // Obsłuż różne formaty dat
    let date;
    if (dateString.includes('.')) {
        // Format DD.MM.YYYY
        const parts = dateString.split('.');
        date = new Date(parts[2], parts[1] - 1, parts[0]);
    } else {
        // Format YYYY-MM-DD
        date = new Date(dateString);
    }
    
    return date.toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}
// ===== OBSŁUGA REZERWACJI =====
function updateCalendarAvailability() {
    if (!selectedCar || !flatpickrInstance) return;
    
    // Pobierz rezerwacje dla wybranego auta
    const carReservations = reservations.filter(r => 
        r.carId === selectedCar && 
        r.id !== editingReservationId && 
        r.status !== 'cancelled'
    );
    
    // Utwórz tablicę z zajętymi datami
    const disabledDates = [];
    
    carReservations.forEach(reservation => {
        const startDate = new Date(reservation.startDate);
        const endDate = new Date(reservation.endDate);
        
        // Dodaj wszystkie daty z zakresu rezerwacji jako niedostępne
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            disabledDates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });
    
    // Zaktualizuj kalendarz
    flatpickrInstance.set('disable', disabledDates);
    
    // Dodatkowe informacje o zajętych terminach
    if (carReservations.length > 0) {
        console.log('Zajęte terminy dla', selectedCar, ':', carReservations);
    }
}

// ===== ZATWIERDZANIE REZERWACJI =====
function submitReservation() {
    const user = getCurrentUser();
    if (!user) return;
    
    const selectedDates = flatpickrInstance ? flatpickrInstance.selectedDates : [];
    
    if (!selectedCar) {
        showMessage('message', 'Wybierz auto', 'error');
        return;
    }
    
    if (selectedDates.length !== 2) {
        showMessage('message', 'Wybierz zakres dat (kliknij dzień rozpoczęcia i zakończenia)', 'error');
        return;
    }
    
    const startDate = selectedDates[0];
    const endDate = selectedDates[1];
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    if (diffDays > 7) {
        showMessage('message', 'Możesz zarezerwować auto maksymalnie na 7 dni', 'error');
        return;
    }
    
    // POPRAWIONE: Sprawdź czy auto jest dostępne w wybranym okresie
    const isAvailable = checkCarAvailability(selectedCar, startDate, endDate, editingReservationId);
    
    if (!isAvailable.available) {
        showMessage('message', `Auto jest już zarezerwowane w wybranym okresie. Konflikt z rezerwacją: ${isAvailable.conflictInfo}`, 'error');
        return;
    }
    
    // POPRAWIONE: Zapewnij poprawny format dat
    const startDateStr = formatDateForStorage(startDate);
    const endDateStr = formatDateForStorage(endDate);
    
    // Przygotuj dane rezerwacji
    const reservationData = {
        id: editingReservationId || generateReservationId(),
        carId: selectedCar,
        carName: CARS.find(c => c.id === selectedCar)?.name || selectedCar,
        employeeName: document.getElementById('employeeName').value,
        department: document.getElementById('employeeDepartment').value,
        startDate: startDateStr,
        endDate: endDateStr,
        purpose: document.getElementById('purpose').value,
        bookingDate: new Date().toISOString().split('T')[0],
        login: editingReservationId ? reservations.find(r => r.id === editingReservationId)?.login : user.login,
        status: 'active',
        daysCount: diffDays
    };
    
    if (editingReservationId) {
        // Aktualizuj istniejącą rezerwację
        const index = reservations.findIndex(r => r.id === editingReservationId);
        if (index !== -1) {
            reservations[index] = reservationData;
        }
    } else {
        // Dodaj nową rezerwację
        reservations.push(reservationData);
    }
    
    saveReservationsToStorage();
    
    showMessage('message', editingReservationId ? 'Rezerwacja została zaktualizowana!' : 'Rezerwacja została zapisana!', 'success');
    
    // Zresetuj formularz
    resetReservationForm();
    
    // Odśwież wyświetlane dane
    updateCarAvailabilityDisplay();
    updateUserReservationsDisplay();
    updateCalendarAvailability();
    
    // Aktualizuj kalendarz miesiąca jeśli istnieje
    if (monthCalendarInstance) {
        updateMonthCalendarDisplay();
    }
    
    // Aktualizuj datę ostatniej aktualizacji
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (lastUpdateElement) {
        lastUpdateElement.textContent = `Ostatnia aktualizacja: ${new Date().toLocaleString('pl-PL')}`;
    }
}

// NOWA FUNKCJA: Sprawdzanie dostępności auta
function checkCarAvailability(carId, startDate, endDate, excludeReservationId = null) {
    const carReservations = reservations.filter(r => 
        r.carId === carId && 
        r.id !== excludeReservationId && 
        r.status !== 'cancelled'
    );
    
    // Normalizuj daty (ustaw godzinę na 00:00:00)
    const normalizedStart = new Date(startDate);
    normalizedStart.setHours(0, 0, 0, 0);
    
    const normalizedEnd = new Date(endDate);
    normalizedEnd.setHours(0, 0, 0, 0);
    
    // Sprawdź każdą istniejącą rezerwację
    for (const reservation of carReservations) {
        const resStart = new Date(reservation.startDate);
        resStart.setHours(0, 0, 0, 0);
        
        const resEnd = new Date(reservation.endDate);
        resEnd.setHours(0, 0, 0, 0);
        
        // Sprawdź czy zakresy się nakładają
        // Warunek nakładania się zakresów:
        // 1. Nowa rezerwacja zaczyna się podczas istniejącej rezerwacji
        // 2. Nowa rezerwacja kończy się podczas istniejącej rezerwacji
        // 3. Nowa rezerwacja całkowicie zawiera istniejącą rezerwację
        // 4. Istniejąca rezerwacja całkowicie zawiera nową rezerwację
        
        const conflictExists = 
            (normalizedStart >= resStart && normalizedStart <= resEnd) || // Nowa zaczyna się podczas istniejącej
            (normalizedEnd >= resStart && normalizedEnd <= resEnd) ||     // Nowa kończy się podczas istniejącej
            (normalizedStart <= resStart && normalizedEnd >= resEnd) ||   // Nowa zawiera istniejącą
            (resStart <= normalizedStart && resEnd >= normalizedEnd);     // Istniejąca zawiera nową
        
        if (conflictExists) {
            return {
                available: false,
                conflictInfo: `${reservation.employeeName} (${formatDate(reservation.startDate)} - ${formatDate(reservation.endDate)})`
            };
        }
    }
    
    return {
        available: true,
        conflictInfo: null
    };
}

// NOWA FUNKCJA: Wizualne oznaczenie zajętych dat
function highlightUnavailableDates() {
    if (!selectedCar || !flatpickrInstance) return;
    
    const carReservations = reservations.filter(r => 
        r.carId === selectedCar && 
        r.id !== editingReservationId && 
        r.status !== 'cancelled'
    );
    
    // Pobierz wszystkie dni w kalendarzu
    const calendarDays = document.querySelectorAll('.flatpickr-day');
    
    calendarDays.forEach(day => {
        // Resetuj styl
        day.classList.remove('unavailable-date');
        day.classList.remove('partially-unavailable');
        
        const dayDate = day.dateObj;
        if (!dayDate) return;
        
        // Normalizuj datę dnia
        const normalizedDay = new Date(dayDate);
        normalizedDay.setHours(0, 0, 0, 0);
        
        // Sprawdź czy dzień jest zajęty
        let isUnavailable = false;
        let reservationInfo = '';
        
        for (const reservation of carReservations) {
            const resStart = new Date(reservation.startDate);
            resStart.setHours(0, 0, 0, 0);
            
            const resEnd = new Date(reservation.endDate);
            resEnd.setHours(0, 0, 0, 0);
            
            if (normalizedDay >= resStart && normalizedDay <= resEnd) {
                isUnavailable = true;
                reservationInfo = `Zajęte przez: ${reservation.employeeName}`;
                break;
            }
        }
        
        if (isUnavailable && !day.classList.contains('disabled')) {
            day.classList.add('unavailable-date');
            
            // Dodaj tooltip z informacją
            day.title = reservationInfo;
        }
    });
}

// Zaktualizuj funkcję initReservationCalendar
function initReservationCalendar() {
    if (!document.getElementById('reservationDates')) return;
    
    flatpickrInstance = flatpickr("#reservationDates", {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: "pl",
        minDate: "today",
        maxDate: new Date().fp_incr(90),
        disableMobile: true,
        allowInput: false,
        clickOpens: true,
        time_24hr: true,
        onReady: function(selectedDates, dateStr, instance) {
            instance.set('altInput', true);
            instance.set('altFormat', 'd.m.Y');
            
            // Oznacz zajęte daty po załadowaniu kalendarza
            setTimeout(() => highlightUnavailableDates(), 100);
        },
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                const startDate = selectedDates[0];
                const endDate = selectedDates[1];
                const diffTime = Math.abs(endDate - startDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                
                if (diffDays > 7) {
                    showMessage('message', 'Możesz zarezerwować auto maksymalnie na 7 dni', 'error');
                    instance.clear();
                    return;
                }
                
                // SPRAWDŹ DOSTĘPNOŚĆ NA BIERZĄCO
                if (selectedCar) {
                    const availability = checkCarAvailability(selectedCar, startDate, endDate, editingReservationId);
                    if (!availability.available) {
                        showMessage('message', `Auto jest już zarezerwowane w tym terminie! Konflikt: ${availability.conflictInfo}`, 'error');
                        instance.clear();
                        return;
                    }
                }
                
                const formattedStart = formatDateForDisplay(startDate);
                const formattedEnd = formatDateForDisplay(endDate);
                
                instance.input.value = `${formattedStart} do ${formattedEnd}`;
            } else if (selectedDates.length === 1) {
                const selectedDate = selectedDates[0];
                const formattedDate = formatDateForDisplay(selectedDate);
                instance.input.value = `${formattedDate} (kliknij ten sam dzień dla rezerwacji 1-dniowej)`;
            }
            
            // Oznacz zajęte daty po zmianie
            highlightUnavailableDates();
        },
        onMonthChange: function() {
            // Oznacz zajęte daty przy zmianie miesiąca
            setTimeout(() => highlightUnavailableDates(), 100);
        },
        onOpen: function() {
            // Oznacz zajęte daty przy otwarciu kalendarza
            setTimeout(() => highlightUnavailableDates(), 100);
        },
        onClose: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                const startDate = selectedDates[0];
                const endDate = selectedDates[1];
                const formattedStart = formatDateForDisplay(startDate);
                const formattedEnd = formatDateForDisplay(endDate);
                instance.input.value = `${formattedStart} do ${formattedEnd}`;
            } else if (selectedDates.length === 1) {
                const singleDate = selectedDates[0];
                instance.setDate([singleDate, singleDate], true);
                const formattedDate = formatDateForDisplay(singleDate);
                instance.input.value = `${formattedDate} (1 dzień)`;
            }
        }
    });
}

// Zaktualizuj funkcję obsługi zmiany auta
if (document.getElementById('employeeName')) {
    document.addEventListener('DOMContentLoaded', function() {
        // ... (istniejący kod) ...
        
        // Obsługa zmiany wyboru auta
        document.getElementById('carSelect').addEventListener('change', function() {
            selectedCar = this.value;
            const calendarSection = document.getElementById('calendarSection');
            
            if (selectedCar) {
                calendarSection.classList.remove('hidden');
                updateCalendarAvailability();
                
                // Oznacz zajęte daty
                setTimeout(() => highlightUnavailableDates(), 100);
                
                // Pobierz informacje o najbliższych rezerwacjach
                showNextAvailableDates(selectedCar);
            } else {
                calendarSection.classList.add('hidden');
            }
        });
        
        // ... (reszta kodu) ...
    });
}

// NOWA FUNKCJA: Pokazuj najbliższe dostępne terminy
function showNextAvailableDates(carId) {
    const carReservations = reservations.filter(r => 
        r.carId === carId && 
        r.status !== 'cancelled'
    ).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let nextAvailableFrom = today;
    
    // Znajdź najbliższy wolny termin
    for (const reservation of carReservations) {
        const resStart = new Date(reservation.startDate);
        resStart.setHours(0, 0, 0, 0);
        
        const resEnd = new Date(reservation.endDate);
        resEnd.setHours(0, 0, 0, 0);
        
        // Jeśli rezerwacja jest w przyszłości
        if (resStart > today) {
            // Sprawdź czy jest przerwa między obecną datą a początkiem rezerwacji
            const gap = Math.ceil((resStart - nextAvailableFrom) / (1000 * 60 * 60 * 24));
            
            if (gap > 0) {
                // Znaleziono wolny termin
                const availableInfo = document.getElementById('availabilityInfo');
                if (!availableInfo) {
                    const formGroup = document.querySelector('#calendarSection .form-group');
                    if (formGroup) {
                        const infoDiv = document.createElement('div');
                        infoDiv.id = 'availabilityInfo';
                        infoDiv.className = 'availability-info';
                        formGroup.appendChild(infoDiv);
                    }
                }
                
                const infoDiv = document.getElementById('availabilityInfo');
                if (infoDiv) {
                    infoDiv.innerHTML = `
                        <div class="availability-message">
                            <i class="fas fa-info-circle"></i>
                            <span>Auto dostępne od ${formatDateForDisplay(nextAvailableFrom)} do ${formatDateForDisplay(new Date(resStart.getTime() - 24 * 60 * 60 * 1000))}</span>
                        </div>
                    `;
                }
                
                return;
            }
            
            // Ustaw datę na dzień po zakończeniu rezerwacji
            nextAvailableFrom = new Date(resEnd.getTime() + 24 * 60 * 60 * 1000);
        } else if (resEnd >= today) {
            // Rezerwacja trwa lub właśnie się zakończyła
            nextAvailableFrom = new Date(resEnd.getTime() + 24 * 60 * 60 * 1000);
        }
    }
    
    // Jeśli nie ma żadnych konfliktów
    const infoDiv = document.getElementById('availabilityInfo');
    if (infoDiv) {
        infoDiv.innerHTML = `
            <div class="availability-message available">
                <i class="fas fa-check-circle"></i>
                <span>Auto dostępne od ${formatDateForDisplay(nextAvailableFrom)}</span>
            </div>
        `;
    }
}

// ===== DODATKOWE FUNKCJE POMOCNICZE =====

// Funkcja sprawdzająca nakładanie się rezerwacji przy ładowaniu
function validateReservations() {
    const conflicts = [];
    
    // Dla każdego auta sprawdź nakładanie się rezerwacji
    CARS.forEach(car => {
        const carReservations = reservations.filter(r => 
            r.carId === car.id && 
            r.status !== 'cancelled'
        ).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        
        // Sprawdź każdą parę rezerwacji
        for (let i = 0; i < carReservations.length; i++) {
            for (let j = i + 1; j < carReservations.length; j++) {
                const res1 = carReservations[i];
                const res2 = carReservations[j];
                
                const start1 = new Date(res1.startDate);
                const end1 = new Date(res1.endDate);
                const start2 = new Date(res2.startDate);
                const end2 = new Date(res2.endDate);
                
                // Sprawdź nakładanie
                if (!(end1 < start2 || start1 > end2)) {
                    conflicts.push({
                        car: car.name,
                        reservation1: `${res1.employeeName} (${formatDate(res1.startDate)} - ${formatDate(res1.endDate)})`,
                        reservation2: `${res2.employeeName} (${formatDate(res2.startDate)} - ${formatDate(res2.endDate)})`
                    });
                }
            }
        }
    });
    
    if (conflicts.length > 0) {
        console.warn('Znaleziono konflikty w rezerwacjach:', conflicts);
        
        // Możesz dodać powiadomienie dla administratora
        if (currentUser && (currentUser.role === 'admin' || currentUser.login === 'admin')) {
            showMessage('message', `Uwaga: Znaleziono ${conflicts.length} konfliktów w rezerwacjach. Sprawdź konsolę.`, 'warning');
        }
    }
    
    return conflicts;
}

// Dodaj walidację przy ładowaniu rezerwacji
function loadReservations() {
    // ... (istniejący kod) ...
    
    if (savedReservations) {
        reservations = JSON.parse(savedReservations);
        
        // Wyczyść stare rezerwacje
        cleanOldReservations();
        
        // WALIDACJA: Sprawdź czy nie ma konfliktów
        validateReservations();
    } else {
        // ... (reszta kodu) ...
    }
    
    // ... (reszta funkcji) ...
}

// ===== ROZSZERZENIE O FUNKCJE RAPORTOWANIA =====
function exportReservationsToPDF() {
    const user = getCurrentUser();
    if (!user) return;
    
    // Pobierz wszystkie rezerwacje
    const allReservations = reservations.filter(r => r.status !== 'cancelled');
    
    // Utwórz zawartość HTML
    const content = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #4CAF50; color: white; }
                .header { margin-bottom: 30px; }
                .date { font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Raport rezerwacji aut służbowych</h1>
                <p class="date">Wygenerowano: ${new Date().toLocaleString('pl-PL')}</p>
                <p>Liczba rezerwacji: ${allReservations.length}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Auto</th>
                        <th>Pracownik</th>
                        <th>Dział</th>
                        <th>Od</th>
                        <th>Do</th>
                        <th>Cel wyjazdu</th>
                        <th>Liczba dni</th>
                    </tr>
                </thead>
                <tbody>
                    ${allReservations.map(reservation => `
                        <tr>
                            <td>${reservation.carName}</td>
                            <td>${reservation.employeeName}</td>
                            <td>${reservation.department}</td>
                            <td>${formatDate(reservation.startDate)}</td>
                            <td>${formatDate(reservation.endDate)}</td>
                            <td>${reservation.purpose}</td>
                            <td>${reservation.daysCount || 1}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;
    
    // Eksport do PDF (użyj jsPDF z html2canvas)
    if (typeof html2canvas !== 'undefined' && typeof jsPDF !== 'undefined') {
        html2canvas(document.body).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const imgHeight = canvas.height * imgWidth / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save('raport-rezerwacji.pdf');
        });
    } else {
        // Fallback - pobierz jako HTML
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'raport-rezerwacji.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    showMessage('message', 'Generowanie raportu PDF...', 'info');
}

// ===== GENEROWANIE RAPORTÓW MIESIĘCZNYCH =====
function generateMonthlyReports() {
    const user = getCurrentUser();
    if (!user || (user.role !== 'admin' && user.login !== 'admin')) {
        showMessage('message', 'Brak uprawnień do generowania raportów', 'error');
        return;
    }
    
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    // Generuj raport dla bieżącego miesiąca
    const report = generateMonthlyReport(currentMonth, currentYear);
    
    // Wyświetl raport
    displayMonthlyReport(report);
    
    // Eksportuj do PDF
    exportMonthlyReportToPDF(report);
}

function displayMonthlyReport(report) {
    // Utwórz okno modalne z raportem
    const modal = document.createElement('div');
    modal.className = 'report-modal';
    modal.style.cssText = `
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
    modalContent.className = 'report-content';
    modalContent.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 10px;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
    `;
    
    modalContent.innerHTML = `
        <h2>Raport miesięczny: ${report.month}/${report.year}</h2>
        <div class="report-summary">
            <p><strong>Łączna liczba rezerwacji:</strong> ${report.totalReservations}</p>
            <p><strong>Łączna liczba dni:</strong> ${report.totalDays}</p>
        </div>
        <div class="report-sections">
            <h3>Rezerwacje według auta</h3>
            ${Object.entries(report.byCar).map(([car, data]) => `
                <p>${car}: ${data.count} rezerwacji, ${data.days} dni</p>
            `).join('')}
        </div>
        <button onclick="this.closest('.report-modal').remove()" style="margin-top: 20px;">
            Zamknij
        </button>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
}

function exportMonthlyReportToPDF(report) {
    const content = `
        <h1>Raport miesięczny rezerwacji</h1>
        <p>Miesiąc: ${report.month}/${report.year}</p>
        <p>Łączna liczba rezerwacji: ${report.totalReservations}</p>
        <p>Łączna liczba dni: ${report.totalDays}</p>
        <h2>Rezerwacje według auta:</h2>
        ${Object.entries(report.byCar).map(([car, data]) => 
            `<p>${car}: ${data.count} rezerwacji, ${data.days} dni</p>`
        ).join('')}
    `;
    
    // Eksport do PDF (podobnie jak w exportReservationsToPDF)
    exportToPDF(content, `raport-miesieczny-${report.month}-${report.year}.pdf`);
}

// ===== DODAJ PRZYCISKI DO GENEROWANIA RAPORTÓW =====
function addReportButtons() {
    const user = getCurrentUser();
    if (!user || (user.role !== 'admin' && user.login !== 'admin')) return;
    
    const infoSection = document.querySelector('.info-section');
    if (!infoSection) return;
    
    // Sprawdź czy przyciski już istnieją
    if (document.getElementById('reportButtons')) return;
    
    const reportButtonsHTML = `
        <div id="reportButtons" style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <h3><i class="fas fa-chart-bar"></i> Raporty i eksport</h3>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px;">
                <button onclick="exportReservationsToPDF()" class="btn-admin" style="background: #3498db;">
                    <i class="fas fa-file-pdf"></i> Eksportuj do PDF
                </button>
                <button onclick="generateMonthlyReports()" class="btn-admin" style="background: #e67e22;">
                    <i class="fas fa-chart-line"></i> Generuj raport miesięczny
                </button>
                <button onclick="exportAllReservationsToExcel()" class="btn-admin" style="background: #27ae60;">
                    <i class="fas fa-file-excel"></i> Eksportuj do Excel
                </button>
            </div>
        </div>
    `;
    
    infoSection.insertAdjacentHTML('beforeend', reportButtonsHTML);
}

// NOWA FUNKCJA: Eksport do Excel
function exportAllReservationsToExcel() {
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Auto,Pracownik,Dział,Data rozpoczęcia,Data zakończenia,Cel wyjazdu,Liczba dni\n"
        + reservations.filter(r => r.status !== 'cancelled').map(reservation => 
            `"${reservation.carName}","${reservation.employeeName}","${reservation.department}",` +
            `"${formatDate(reservation.startDate)}","${formatDate(reservation.endDate)}",` +
            `"${reservation.purpose}","${reservation.daysCount || 1}"`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "rezerwacje.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showMessage('message', 'Eksport do CSV/Excel zakończony', 'success');
}

// ===== AKTUALIZACJA INICJALIZACJI =====
// W funkcji DOMContentLoaded dodaj:
if (document.getElementById('employeeName')) {
    document.addEventListener('DOMContentLoaded', function() {
        // ... (istniejący kod) ...
        
        // DODAJ TE LINIE:
        addReportButtons();
        
        // Dodaj biblioteki do generowania PDF
        addPDFLibraries();
        
        // ... (reszta kodu) ...
    });
}

// NOWA FUNKCJA: Dodaj biblioteki PDF
function addPDFLibraries() {
    // Sprawdź czy biblioteki już zostały dodane
    if (window.jspdf && window.html2canvas) return;
    
    // Dodaj jsPDF
    const jspdfScript = document.createElement('script');
    jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    document.head.appendChild(jspdfScript);
    
    // Dodaj html2canvas
    const html2canvasScript = document.createElement('script');
    html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    document.head.appendChild(html2canvasScript);
}

// Eksportuj nowe funkcje
window.exportReservationsToPDF = exportReservationsToPDF;
window.generateMonthlyReports = generateMonthlyReports;
window.exportAllReservationsToExcel = exportAllReservationsToExcel;
// ===== KALENDARZ MIESIĄCA =====
function initMonthCalendar() {
    if (!document.getElementById('monthCalendar')) return;
    
    monthCalendarInstance = flatpickr("#monthCalendar", {
        inline: true,
        static: true,
        mode: "multiple",
        dateFormat: "Y-m-d",
        locale: "pl",
        showMonths: 1,
        disableMobile: true,
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            // Oznacz zajęte dni
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            const isReserved = reservations.some(r => {
                const start = new Date(r.startDate);
                const end = new Date(r.endDate);
                const current = new Date(dateStr);
                return current >= start && current <= end && r.status !== 'cancelled';
            });
            
            if (isReserved) {
                dayElem.classList.add('reserved-day');
                dayElem.innerHTML += '<span class="reserved-badge"><i class="fas fa-car"></i></span>';
            }
        }
    });
    
    // Dodaj przyciski nawigacji
    addMonthCalendarNavigation();
    updateMonthCalendarDisplay();
}

function addMonthCalendarNavigation() {
    const calendarContainer = document.querySelector('.month-calendar-container');
    if (!calendarContainer) return;
    
    // Sprawdź czy nawigacja już istnieje
    if (calendarContainer.querySelector('.calendar-navigation')) return;
    
    const navHTML = `
        <div class="calendar-navigation">
            <button id="prevMonth" class="btn-calendar-nav">
                <i class="fas fa-chevron-left"></i> Poprzedni miesiąc
            </button>
            <h3 id="currentMonthDisplay">${getCurrentMonthName()}</h3>
            <button id="nextMonth" class="btn-calendar-nav">
                Następny miesiąc <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;
    
    calendarContainer.insertAdjacentHTML('afterbegin', navHTML);
    
    document.getElementById('prevMonth').addEventListener('click', function() {
        if (monthCalendarInstance) {
            monthCalendarInstance.changeMonth(-1);
            updateMonthCalendarDisplay();
        }
    });
    
    document.getElementById('nextMonth').addEventListener('click', function() {
        if (monthCalendarInstance) {
            monthCalendarInstance.changeMonth(1);
            updateMonthCalendarDisplay();
        }
    });
}

function updateMonthCalendarDisplay() {
    if (!monthCalendarInstance) return;
    
    const currentMonth = monthCalendarInstance.currentMonth;
    const currentYear = monthCalendarInstance.currentYear;
    const displayElement = document.getElementById('currentMonthDisplay');
    
    if (displayElement) {
        const monthNames = [
            'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
            'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
        ];
        displayElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    }
    
    // Oznacz wszystkie rezerwacje
    markReservationsOnCalendar();
}

function markReservationsOnCalendar() {
    if (!monthCalendarInstance) return;
    
    const calendarDays = document.querySelectorAll('.flatpickr-day');
    calendarDays.forEach(day => {
        day.classList.remove('reserved-day');
        day.classList.remove('reserved-by-user');
        
        const dateStr = day.dateObj.toISOString().split('T')[0];
        
        // Sprawdź rezerwacje dla tego dnia
        reservations.forEach(reservation => {
            if (reservation.status === 'cancelled') return;
            
            const start = new Date(reservation.startDate);
            const end = new Date(reservation.endDate);
            const current = new Date(dateStr);
            
            if (current >= start && current <= end) {
                day.classList.add('reserved-day');
                
                // Jeśli to rezerwacja aktualnego użytkownika
                const user = getCurrentUser();
                if (user && reservation.login === user.login) {
                    day.classList.add('reserved-by-user');
                }
                
                // Dodaj tooltip z informacją
                const car = CARS.find(c => c.id === reservation.carId);
                const carName = car ? car.name : reservation.carId;
                day.title = `Zarezerwowane: ${carName}\nPrzez: ${reservation.employeeName}`;
            }
        });
    });
}

function getCurrentMonthName() {
    const monthNames = [
        'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
        'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    const now = new Date();
    return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
}

// ===== OBSŁUGA REZERWACJI =====
function updateCalendarAvailability() {
    if (!selectedCar || !flatpickrInstance) return;
    
    // Pobierz rezerwacje dla wybranego auta
    const carReservations = reservations.filter(r => 
        r.carId === selectedCar && 
        r.id !== editingReservationId && 
        r.status !== 'cancelled'
    );
    
    // Utwórz tablicę z zajętymi datami
    const disabledDates = [];
    
    carReservations.forEach(reservation => {
        const startDate = new Date(reservation.startDate);
        const endDate = new Date(reservation.endDate);
        
        // Dodaj wszystkie daty z zakresu rezerwacji jako niedostępne
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            disabledDates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });
    
    // Zaktualizuj kalendarz
    flatpickrInstance.set('disable', disabledDates);
}

function loadReservations() {
    // Sprawdź czy istnieją zapisane rezerwacje w localStorage
    const savedReservations = localStorage.getItem('carReservations');
    
    if (savedReservations) {
        reservations = JSON.parse(savedReservations);
        
        // Wyczyść stare rezerwacje przy ładowaniu
        cleanOldReservations();
    } else {
        // Użyj domyślnych rezerwacji
        reservations = [
            {
                id: generateReservationId(),
                carId: "Auto1",
                carName: "Toyota Corolla",
                employeeName: "Jan Kowalski",
                department: "IT",
                startDate: getDateString(5),
                endDate: getDateString(7),
                purpose: "Wyjazd służbowy do klienta",
                bookingDate: getDateString(0),
                login: "pracownik1",
                status: "active"
            },
            {
                id: generateReservationId(),
                carId: "Auto3",
                carName: "Skoda Octavia",
                employeeName: "Anna Nowak",
                department: "Marketing",
                startDate: getDateString(10),
                endDate: getDateString(12),
                purpose: "Targi branżowe",
                bookingDate: getDateString(0),
                login: "pracownik2",
                status: "active"
            }
        ];
        saveReservationsToStorage();
    }
    
    updateCarAvailabilityDisplay();
    updateUserReservationsDisplay();
    
    // Zaktualizuj kalendarz miesiąca jeśli istnieje
    if (monthCalendarInstance) {
        updateMonthCalendarDisplay();
    }
}

function saveReservationsToStorage() {
    localStorage.setItem('carReservations', JSON.stringify(reservations));
}

function getDateString(daysFromNow) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
}

function updateCarAvailabilityDisplay() {
    const container = document.getElementById('carAvailability');
    if (!container) return;
    
    container.innerHTML = '';
    
    CARS.forEach(car => {
        const carElement = document.createElement('div');
        carElement.className = 'car-item';
        
        // Sprawdź czy auto jest zarezerwowane w najbliższych dniach
        const today = new Date();
        const carReservations = reservations.filter(r => r.carId === car.id && r.status !== 'cancelled');
        const upcomingReservations = carReservations.filter(r => new Date(r.endDate) >= today);
        
        if (upcomingReservations.length > 0) {
            // Auto jest zajęte
            carElement.classList.add('unavailable');
            
            // Znajdź najbliższą rezerwację
            const sortedReservations = upcomingReservations.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
            const nextReservation = sortedReservations[0];
            
            carElement.innerHTML = `
                <h5>${car.name} (${car.plate})</h5>
                <div class="car-dates">
                    <i class="fas fa-calendar-times"></i> Zajęte: ${formatDate(nextReservation.startDate)} - ${formatDate(nextReservation.endDate)}
                </div>
                <div class="car-purpose">
                    <i class="fas fa-user"></i> ${nextReservation.employeeName}
                </div>
                <div class="car-availability-info">
                    <small>Kolejna dostępność: ${getNextAvailableDate(car.id)}</small>
                </div>
            `;
        } else {
            // Auto jest dostępne
            carElement.classList.add('available');
            carElement.innerHTML = `
                <h5>${car.name} (${car.plate})</h5>
                <div class="car-dates">
                    <i class="fas fa-calendar-check"></i> Dostępne od dzisiaj
                </div>
                <div class="car-availability-info">
                    <small>Brak rezerwacji w najbliższych dniach</small>
                </div>
            `;
        }
        
        container.appendChild(carElement);
    });
}

function getNextAvailableDate(carId) {
    const today = new Date();
    const carReservations = reservations
        .filter(r => r.carId === carId && r.status !== 'cancelled')
        .sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
    
    if (carReservations.length === 0) {
        return 'dziś';
    }
    
    const lastReservation = carReservations[carReservations.length - 1];
    const lastEndDate = new Date(lastReservation.endDate);
    
    if (lastEndDate < today) {
        return 'dziś';
    }
    
    // Znajdź następny wolny termin
    const nextDay = new Date(lastEndDate);
    nextDay.setDate(nextDay.getDate() + 1);
    return formatDate(nextDay);
}

function updateUserReservationsDisplay() {
    const user = getCurrentUser();
    if (!user) return;
    
    const container = document.getElementById('userReservations');
    if (!container) return;
    
    container.innerHTML = '';
    
    const userReservations = reservations.filter(r => r.login === user.login && r.status !== 'cancelled');
    
    if (userReservations.length === 0) {
        container.innerHTML = '<p>Nie masz żadnych aktywnych rezerwacji.</p>';
        return;
    }
    
    userReservations.forEach(reservation => {
        const car = CARS.find(c => c.id === reservation.carId);
        const reservationElement = document.createElement('div');
        reservationElement.className = 'reservation-item';
        
        let actionsHtml = '';
        const user = getCurrentUser();
        if (user && (user.role === 'admin' || user.login === 'admin')) {
            actionsHtml = `
                <div class="reservation-actions">
                    <button class="btn-edit-small" onclick="editUserReservation('${reservation.id}')">
                        <i class="fas fa-edit"></i> Edytuj
                    </button>
                    <button class="btn-delete-small" onclick="deleteUserReservation('${reservation.id}')">
                        <i class="fas fa-trash"></i> Usuń
                    </button>
                </div>
            `;
        } else {
            actionsHtml = `
                <div class="reservation-actions">
                    <button class="btn-edit-small" onclick="editUserReservation('${reservation.id}')">
                        <i class="fas fa-edit"></i> Edytuj
                    </button>
                    <button class="btn-cancel-small" onclick="cancelUserReservation('${reservation.id}')">
                        <i class="fas fa-times"></i> Anuluj
                    </button>
                </div>
            `;
        }
        
        const today = new Date();
        const startDate = new Date(reservation.startDate);
        const endDate = new Date(reservation.endDate);
        let statusBadge = '';
        
        if (endDate < today) {
            statusBadge = '<span class="status-badge status-past">Zakończona</span>';
        } else if (startDate <= today && endDate >= today) {
            statusBadge = '<span class="status-badge status-active">W trakcie</span>';
        } else {
            statusBadge = '<span class="status-badge status-upcoming">Nadchodząca</span>';
        }
        
        reservationElement.innerHTML = `
            <div class="reservation-header">
                <h5>${car ? car.name : reservation.carId} ${statusBadge}</h5>
            </div>
            <div class="reservation-dates">
                <i class="fas fa-calendar"></i> ${formatDate(reservation.startDate)} - ${formatDate(reservation.endDate)}
            </div>
            <div class="reservation-purpose">
                <i class="fas fa-clipboard-list"></i> ${reservation.purpose}
            </div>
            <div class="reservation-department">
                <i class="fas fa-building"></i> ${reservation.department}
            </div>
            ${actionsHtml}
        `;
        
        container.appendChild(reservationElement);
    });
}

// ===== AKCJE NA REZERWACJACH =====
function editUserReservation(reservationId) {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) return;
    
    const user = getCurrentUser();
    if (!user) return;
    
    // Sprawdź uprawnienia (admin lub właściciel rezerwacji)
    if (user.role !== 'admin' && user.login !== 'admin' && reservation.login !== user.login) {
        showMessage('message', 'Brak uprawnień do edycji tej rezerwacji', 'error');
        return;
    }
    
    // Wypełnij formularz danymi rezerwacji
    document.getElementById('employeeName').value = reservation.employeeName;
    document.getElementById('employeeDepartment').value = reservation.department;
    document.getElementById('carSelect').value = reservation.carId;
    document.getElementById('purpose').value = reservation.purpose;
    
    // Ustaw wybrane auto
    selectedCar = reservation.carId;
    const calendarSection = document.getElementById('calendarSection');
    if (calendarSection) {
        calendarSection.classList.remove('hidden');
    }
    
    // Ustaw daty w kalendarzu
    const startDate = new Date(reservation.startDate);
    const endDate = new Date(reservation.endDate);
    
    // Ustawienie dat w flatpickr
    if (flatpickrInstance) {
        flatpickrInstance.setDate([startDate, endDate], false);
        
        // Upewnij się, że data jest poprawnie ustawiona w polu input
        const formattedStart = startDate.toISOString().split('T')[0];
        const formattedEnd = endDate.toISOString().split('T')[0];
        document.getElementById('reservationDates').value = `${formattedStart} do ${formattedEnd}`;
    }
    
    // Ustaw tryb edycji
    editingReservationId = reservationId;
    
    // Zmień tekst przycisku
    const submitBtn = document.querySelector('.btn-submit');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Zaktualizuj rezerwację';
    }
    
    // Zaktualizuj dostępność kalendarza
    updateCalendarAvailability();
    
    // Przewiń do formularza
    const formSection = document.querySelector('.form-section');
    if (formSection) {
        formSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    showMessage('message', 'Edytujesz rezerwację. Możesz zmienić dane i zapisać zmiany.', 'info');
}

function cancelUserReservation(reservationId) {
    if (!confirm('Czy na pewno chcesz anulować tę rezerwację?')) return;
    
    const user = getCurrentUser();
    if (!user) return;
    
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) return;
    
    // Sprawdź czy użytkownik może anulować swoją rezerwację
    if (reservation.login !== user.login && user.role !== 'admin' && user.login !== 'admin') {
        showMessage('message', 'Brak uprawnień do anulowania tej rezerwacji', 'error');
        return;
    }
    
    // Oznacz rezerwację jako anulowaną
    const index = reservations.findIndex(r => r.id === reservationId);
    if (index !== -1) {
        reservations[index].status = 'cancelled';
        reservations[index].cancelledDate = new Date().toISOString().split('T')[0];
        reservations[index].cancelledBy = user.login;
        
        saveReservationsToStorage();
        
        updateCarAvailabilityDisplay();
        updateUserReservationsDisplay();
        
        if (selectedCar) {
            updateCalendarAvailability();
        }
        
        if (monthCalendarInstance) {
            updateMonthCalendarDisplay();
        }
        
        showMessage('message', 'Rezerwacja została anulowana', 'success');
    }
}

function deleteUserReservation(reservationId) {
    if (!confirm('Czy na pewno chcesz trwale usunąć tę rezerwację?')) return;
    
    const user = getCurrentUser();
    if (!user || (user.role !== 'admin' && user.login !== 'admin')) {
        showMessage('message', 'Brak uprawnień do usuwania rezerwacji', 'error');
        return;
    }
    
    const index = reservations.findIndex(r => r.id === reservationId);
    if (index !== -1) {
        reservations.splice(index, 1);
        saveReservationsToStorage();
        
        updateCarAvailabilityDisplay();
        updateUserReservationsDisplay();
        
        if (selectedCar) {
            updateCalendarAvailability();
        }
        
        if (monthCalendarInstance) {
            updateMonthCalendarDisplay();
        }
        
        showMessage('message', 'Rezerwacja została trwale usunięta', 'success');
    }
}

// ===== FORMATOWANIE DANYCH =====
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// ===== ZATWIERDZANIE REZERWACJI =====
function submitReservation() {
    const user = getCurrentUser();
    if (!user) return;
    
    const selectedDates = flatpickrInstance ? flatpickrInstance.selectedDates : [];
    
    if (!selectedCar) {
        showMessage('message', 'Wybierz auto', 'error');
        return;
    }
    
    if (selectedDates.length !== 2) {
        showMessage('message', 'Wybierz zakres dat (kliknij dzień rozpoczęcia, a następnie ten sam dzień dla rezerwacji 1-dniowej)', 'error');
        return;
    }
    
    const startDate = selectedDates[0];
    const endDate = selectedDates[1];
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    if (diffDays > 7) {
        showMessage('message', 'Możesz zarezerwować auto maksymalnie na 7 dni', 'error');
        return;
    }
    
    // Sprawdź czy auto jest dostępne w wybranym okresie (pomiń bieżącą rezerwację jeśli edytujemy)
    const carReservations = reservations.filter(r => 
        r.carId === selectedCar && 
        r.id !== editingReservationId && 
        r.status !== 'cancelled'
    );
    
    const isAvailable = carReservations.every(reservation => {
        const resStart = new Date(reservation.startDate);
        const resEnd = new Date(reservation.endDate);
        
        // Sprawdź czy zakresy się nie nakładają
        return (endDate < resStart) || (startDate > resEnd);
    });
    
    if (!isAvailable) {
        showMessage('message', 'Auto jest już zarezerwowane w wybranym okresie', 'error');
        return;
    }
    
    // Przygotuj dane rezerwacji
    const reservationData = {
        id: editingReservationId || generateReservationId(),
        carId: selectedCar,
        carName: CARS.find(c => c.id === selectedCar)?.name || selectedCar,
        employeeName: document.getElementById('employeeName').value,
        department: document.getElementById('employeeDepartment').value,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        purpose: document.getElementById('purpose').value,
        bookingDate: new Date().toISOString().split('T')[0],
        login: editingReservationId ? reservations.find(r => r.id === editingReservationId)?.login : user.login,
        status: 'active',
        daysCount: diffDays
    };
    
    if (editingReservationId) {
        // Aktualizuj istniejącą rezerwację
        const index = reservations.findIndex(r => r.id === editingReservationId);
        if (index !== -1) {
            reservations[index] = reservationData;
        }
    } else {
        // Dodaj nową rezerwację
        reservations.push(reservationData);
    }
    
    saveReservationsToStorage();
    
    showMessage('message', editingReservationId ? 'Rezerwacja została zaktualizowana!' : 'Rezerwacja została zapisana!', 'success');
    
    // Zresetuj formularz
    resetReservationForm();
    
    // Odśwież wyświetlane dane
    updateCarAvailabilityDisplay();
    updateUserReservationsDisplay();
    updateCalendarAvailability();
    
    // Aktualizuj kalendarz miesiąca
    if (monthCalendarInstance) {
        updateMonthCalendarDisplay();
    }
    
    // Aktualizuj datę ostatniej aktualizacji
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (lastUpdateElement) {
        lastUpdateElement.textContent = `Ostatnia aktualizacja: ${new Date().toLocaleString('pl-PL')}`;
    }
}

function resetReservationForm() {
    const form = document.getElementById('reservationForm');
    if (form) {
        form.reset();
    }
    
    const employeeNameInput = document.getElementById('employeeName');
    if (employeeNameInput && currentUser) {
        employeeNameInput.value = currentUser.name;
    }
    
    const calendarSection = document.getElementById('calendarSection');
    if (calendarSection) {
        calendarSection.classList.add('hidden');
    }
    
    const carSelect = document.getElementById('carSelect');
    if (carSelect) {
        carSelect.value = '';
    }
    
    selectedCar = null;
    
    if (flatpickrInstance) {
        flatpickrInstance.clear();
    }
    
    editingReservationId = null;
    
    // Przywróć domyślny tekst przycisku
    const submitBtn = document.querySelector('.btn-submit');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Zatwierdź rezerwację';
    }
    
    // Ukryj ewentualną wiadomość
    const messageElement = document.getElementById('message');
    if (messageElement) {
        messageElement.style.display = 'none';
    }
}

// ===== ŁADOWANIE DANYCH =====
function loadDataFromGoogleSheets() {
    // Symulacja aktualizacji danych co 30 sekund
    setInterval(() => {
        const lastUpdateElement = document.getElementById('lastUpdate');
        if (lastUpdateElement) {
            lastUpdateElement.textContent = `Ostatnia aktualizacja: ${new Date().toLocaleString('pl-PL')}`;
        }
    }, 30000);
}

// ===== EKSPORT I RAPORTY =====
function exportToPDF(content, filename = 'rezerwacja.pdf') {
    // W rzeczywistości użyj biblioteki jsPDF
    // Tutaj symulacja - pobierz jako HTML
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function generateMonthlyReport(month, year) {
    const report = {
        month: month,
        year: year,
        generatedDate: new Date().toISOString(),
        totalReservations: 0,
        totalDays: 0,
        byCar: {},
        byDepartment: {},
        byEmployee: {}
    };
    
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const monthlyReservations = reservations.filter(r => {
        const resDate = new Date(r.startDate);
        return resDate >= startDate && resDate <= endDate && r.status !== 'cancelled';
    });
    
    report.totalReservations = monthlyReservations.length;
    
    monthlyReservations.forEach(reservation => {
        // Liczba dni
        const start = new Date(reservation.startDate);
        const end = new Date(reservation.endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        report.totalDays += days;
        
        // Według auta
        if (!report.byCar[reservation.carId]) {
            report.byCar[reservation.carId] = { count: 0, days: 0 };
        }
        report.byCar[reservation.carId].count++;
        report.byCar[reservation.carId].days += days;
        
        // Według działu
        if (!report.byDepartment[reservation.department]) {
            report.byDepartment[reservation.department] = { count: 0, days: 0 };
        }
        report.byDepartment[reservation.department].count++;
        report.byDepartment[reservation.department].days += days;
        
        // Według pracownika
        if (!report.byEmployee[reservation.employeeName]) {
            report.byEmployee[reservation.employeeName] = { count: 0, days: 0, department: reservation.department };
        }
        report.byEmployee[reservation.employeeName].count++;
        report.byEmployee[reservation.employeeName].days += days;
    });
    
    return report;
}

// ===== EKSPORT FUNKCJI DO GLOBALNEGO ZAKRESU =====
// Ważne: Eksportujemy funkcje, które są używane w onclick w HTML
window.editUserReservation = editUserReservation;
window.deleteUserReservation = deleteUserReservation;
window.cancelUserReservation = cancelUserReservation;
window.exportToPDF = exportToPDF;
window.generateMonthlyReport = generateMonthlyReport;



