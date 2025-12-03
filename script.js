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

// ===== FUNKCJE POMOCNICZE DLA DAT =====

// Tworzy datę z lokalnym czasem bez konwersji UTC
function createLocalDate(year, month, day) {
    // month: 0-11 (jak w JS Date)
    return new Date(year, month, day, 12, 0, 0);
}

// Konwertuje string daty na lokalny Date object
function parseLocalDate(dateString) {
    if (!dateString) return null;
    
    // Obsłuż różne formaty dat
    if (dateString.includes('-')) {
        // Format YYYY-MM-DD
        const [year, month, day] = dateString.split('-').map(Number);
        return createLocalDate(year, month - 1, day);
    } else if (dateString.includes('.')) {
        // Format DD.MM.YYYY
        const [day, month, year] = dateString.split('.').map(Number);
        return createLocalDate(year, month - 1, day);
    } else if (dateString.includes('/')) {
        // Format MM/DD/YYYY lub DD/MM/YYYY
        const parts = dateString.split('/').map(Number);
        if (parts[0] > 12) {
            // DD/MM/YYYY
            return createLocalDate(parts[2], parts[1] - 1, parts[0]);
        } else {
            // MM/DD/YYYY
            return createLocalDate(parts[2], parts[0] - 1, parts[1]);
        }
    }
    
    // Domyślnie spróbuj parsować jako Date
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    // Konwertuj na lokalny czas
    return createLocalDate(date.getFullYear(), date.getMonth(), date.getDate());
}

// Formatuje datę do wyświetlania (DD.MM.YYYY)
function formatDateForDisplay(date) {
    if (!date) return '';
    
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
}

// Formatuje datę do przechowywania (YYYY-MM-DD w lokalnym czasie)
function formatDateForStorage(date) {
    if (!date) return '';
    
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Pobiera tylko datę (bez czasu) z Date object
function getDateOnly(date) {
    if (!date) return null;
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Porównuje tylko daty (ignoruje czas)
function compareDatesOnly(date1, date2) {
    const d1 = getDateOnly(date1);
    const d2 = getDateOnly(date2);
    return d1.getTime() - d2.getTime();
}

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
    sixMonthsAgo.setHours(0, 0, 0, 0);
    
    const initialLength = reservations.length;
    reservations = reservations.filter(reservation => {
        const reservationDate = parseLocalDate(reservation.endDate);
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
                
                // Oznacz zajęte daty
                setTimeout(() => highlightUnavailableDates(), 100);
                
                // Pobierz informacje o najbliższych rezerwacjach
                showNextAvailableDates(selectedCar);
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
        
        // Dodaj przyciski raportów dla admina
        if (user.role === 'admin' || user.login === 'admin') {
            addReportButtons();
        }
        
        // Dodaj biblioteki do generowania PDF
        addPDFLibraries();
        
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
        time_24hr: true,
        
        // Ustaw flatpickr do używania lokalnych dat
        parseDate: function(dateStr) {
            return parseLocalDate(dateStr);
        },
        
        formatDate: function(date, format, locale) {
            // Formatujemy do YYYY-MM-DD, ale z lokalną datą
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },
        
        onReady: function(selectedDates, dateStr, instance) {
            // Używamy alternatywnego formatu dla wyświetlania
            instance.set('altInput', true);
            instance.set('altFormat', 'd.m.Y');
            instance.set('ariaDateFormat', 'd.m.Y');
            
            setTimeout(() => highlightUnavailableDates(), 100);
        },
        
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                const startDate = selectedDates[0];
                const endDate = selectedDates[1];
                
                // Upewnij się, że daty są poprawnie ustawione
                const normalizedStart = getDateOnly(startDate);
                const normalizedEnd = getDateOnly(endDate);
                
                const diffTime = normalizedEnd.getTime() - normalizedStart.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                
                if (diffDays > 7) {
                    showMessage('message', 'Możesz zarezerwować auto maksymalnie na 7 dni', 'error');
                    instance.clear();
                    return;
                }
                
                // Sprawdź dostępność
                if (selectedCar) {
                    const availability = checkCarAvailability(selectedCar, normalizedStart, normalizedEnd, editingReservationId);
                    if (!availability.available) {
                        showMessage('message', `Auto jest już zarezerwowane w tym terminie! Konflikt: ${availability.conflictInfo}`, 'error');
                        instance.clear();
                        return;
                    }
                }
                
                // Pokaż wybrane daty w formacie DD.MM.YYYY
                const formattedStart = formatDateForDisplay(normalizedStart);
                const formattedEnd = formatDateForDisplay(normalizedEnd);
                instance.input.value = `${formattedStart} do ${formattedEnd}`;
                
            } else if (selectedDates.length === 1) {
                const selectedDate = selectedDates[0];
                const normalizedDate = getDateOnly(selectedDate);
                const formattedDate = formatDateForDisplay(normalizedDate);
                instance.input.value = `${formattedDate} (kliknij ten sam dzień dla rezerwacji 1-dniowej)`;
            }
            
            highlightUnavailableDates();
        },
        
        onMonthChange: function() {
            setTimeout(() => highlightUnavailableDates(), 100);
        },
        
        onOpen: function() {
            setTimeout(() => highlightUnavailableDates(), 100);
        },
        
        onClose: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                const startDate = selectedDates[0];
                const endDate = selectedDates[1];
                const normalizedStart = getDateOnly(startDate);
                const normalizedEnd = getDateOnly(endDate);
                
                const formattedStart = formatDateForDisplay(normalizedStart);
                const formattedEnd = formatDateForDisplay(normalizedEnd);
                instance.input.value = `${formattedStart} do ${formattedEnd}`;
            } else if (selectedDates.length === 1) {
                // Dla rezerwacji 1-dniowej
                const singleDate = selectedDates[0];
                const normalizedDate = getDateOnly(singleDate);
                instance.setDate([normalizedDate, normalizedDate], true);
                const formattedDate = formatDateForDisplay(normalizedDate);
                instance.input.value = `${formattedDate} (1 dzień)`;
            }
        }
    });
}

// ===== SPRAWDZANIE DOSTĘPNOŚCI AUTA =====
function checkCarAvailability(carId, startDate, endDate, excludeReservationId = null) {
    const carReservations = reservations.filter(r => 
        r.carId === carId && 
        r.id !== excludeReservationId && 
        r.status !== 'cancelled'
    );
    
    // Normalizuj daty (tylko data, bez czasu)
    const normalizedStart = getDateOnly(startDate);
    const normalizedEnd = getDateOnly(endDate);
    
    // Sprawdź każdą istniejącą rezerwację
    for (const reservation of carReservations) {
        const resStart = parseLocalDate(reservation.startDate);
        const resEnd = parseLocalDate(reservation.endDate);
        
        if (!resStart || !resEnd) continue;
        
        const normalizedResStart = getDateOnly(resStart);
        const normalizedResEnd = getDateOnly(resEnd);
        
        // Sprawdź czy zakresy się nakładają
        const conflictExists = 
            (compareDatesOnly(normalizedStart, normalizedResEnd) <= 0 && 
             compareDatesOnly(normalizedEnd, normalizedResStart) >= 0);
        
        if (conflictExists) {
            return {
                available: false,
                conflictInfo: `${reservation.employeeName} (${formatDateForDisplay(resStart)} - ${formatDateForDisplay(resEnd)})`
            };
        }
    }
    
    return {
        available: true,
        conflictInfo: null
    };
}

// Oznacza zajęte daty w kalendarzu
function highlightUnavailableDates() {
    if (!selectedCar || !flatpickrInstance) return;
    
    const carReservations = reservations.filter(r => 
        r.carId === selectedCar && 
        r.id !== editingReservationId && 
        r.status !== 'cancelled'
    );
    
    // Pobierz wszystkie dni w kalendarzu
    const calendarDays = document.querySelectorAll('.flatpickr-day:not(.flatpickr-disabled)');
    
    calendarDays.forEach(day => {
        // Resetuj styl
        day.classList.remove('unavailable-date');
        day.classList.remove('partially-unavailable');
        
        const dayDate = day.dateObj;
        if (!dayDate) return;
        
        // Normalizuj datę dnia
        const normalizedDay = getDateOnly(dayDate);
        
        // Sprawdź czy dzień jest zajęty
        for (const reservation of carReservations) {
            const resStart = parseLocalDate(reservation.startDate);
            const resEnd = parseLocalDate(reservation.endDate);
            
            if (!resStart || !resEnd) continue;
            
            const normalizedResStart = getDateOnly(resStart);
            const normalizedResEnd = getDateOnly(resEnd);
            
            if (compareDatesOnly(normalizedDay, normalizedResEnd) <= 0 && 
                compareDatesOnly(normalizedDay, normalizedResStart) >= 0) {
                
                day.classList.add('unavailable-date');
                
                // Dodaj tooltip z informacją
                const car = CARS.find(c => c.id === reservation.carId);
                const carName = car ? car.name : reservation.carId;
                day.title = `Zajęte: ${carName}\nPrzez: ${reservation.employeeName}\nCel: ${reservation.purpose}`;
                break;
            }
        }
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
        const startDate = parseLocalDate(reservation.startDate);
        const endDate = parseLocalDate(reservation.endDate);
        
        if (!startDate || !endDate) return;
        
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
        
        // WALIDACJA: Sprawdź i popraw daty w istniejących rezerwacjach
        reservations.forEach(reservation => {
            // Upewnij się, że daty są w poprawnym formacie
            if (reservation.startDate && reservation.endDate) {
                // Jeśli data zawiera czas, usuń go
                if (reservation.startDate.includes('T')) {
                    reservation.startDate = reservation.startDate.split('T')[0];
                }
                if (reservation.endDate.includes('T')) {
                    reservation.endDate = reservation.endDate.split('T')[0];
                }
            }
        });
        
        // Wyczyść stare rezerwacje
        cleanOldReservations();
        
        // Sprawdź czy nie ma konfliktów
        validateReservations();
        
    } else {
        // Użyj domyślnych rezerwacji z POPRAWIONYMI DATAMI
        reservations = [
            {
                id: generateReservationId(),
                carId: "Auto1",
                carName: "Skoda Octavia 1",
                employeeName: "Jan Kowalski",
                department: "IT",
                startDate: formatDateForStorage(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)),
                endDate: formatDateForStorage(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
                purpose: "Wyjazd służbowy do klienta",
                bookingDate: formatDateForStorage(new Date()),
                login: "pracownik1",
                status: "active",
                daysCount: 3
            },
            {
                id: generateReservationId(),
                carId: "Auto3",
                carName: "Skoda Octavia 3",
                employeeName: "Anna Nowak",
                department: "Marketing",
                startDate: formatDateForStorage(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)),
                endDate: formatDateForStorage(new Date(Date.now() + 12 * 24 * 60 * 60 * 1000)),
                purpose: "Targi branżowe",
                bookingDate: formatDateForStorage(new Date()),
                login: "pracownik2",
                status: "active",
                daysCount: 3
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
    return formatDateForStorage(date);
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
        today.setHours(0, 0, 0, 0);
        
        const carReservations = reservations.filter(r => r.carId === car.id && r.status !== 'cancelled');
        const upcomingReservations = carReservations.filter(r => {
            const endDate = parseLocalDate(r.endDate);
            return endDate >= today;
        });
        
        if (upcomingReservations.length > 0) {
            // Auto jest zajęte
            carElement.classList.add('unavailable');
            
            // Znajdź najbliższą rezerwację
            const sortedReservations = upcomingReservations.sort((a, b) => {
                const dateA = parseLocalDate(a.startDate);
                const dateB = parseLocalDate(b.startDate);
                return dateA - dateB;
            });
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
    today.setHours(0, 0, 0, 0);
    
    const carReservations = reservations
        .filter(r => r.carId === carId && r.status !== 'cancelled')
        .sort((a, b) => {
            const dateA = parseLocalDate(a.endDate);
            const dateB = parseLocalDate(b.endDate);
            return dateA - dateB;
        });
    
    if (carReservations.length === 0) {
        return 'dziś';
    }
    
    const lastReservation = carReservations[carReservations.length - 1];
    const lastEndDate = parseLocalDate(lastReservation.endDate);
    
    if (lastEndDate < today) {
        return 'dziś';
    }
    
    // Znajdź następny wolny termin
    const nextDay = new Date(lastEndDate);
    nextDay.setDate(nextDay.getDate() + 1);
    return formatDateForDisplay(nextDay);
}

// Pokazuje najbliższe dostępne terminy
function showNextAvailableDates(carId) {
    const carReservations = reservations.filter(r => 
        r.carId === carId && 
        r.status !== 'cancelled'
    ).sort((a, b) => {
        const dateA = parseLocalDate(a.startDate);
        const dateB = parseLocalDate(b.startDate);
        return dateA - dateB;
    });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let nextAvailableFrom = today;
    
    // Znajdź najbliższy wolny termin
    for (const reservation of carReservations) {
        const resStart = parseLocalDate(reservation.startDate);
        const resEnd = parseLocalDate(reservation.endDate);
        
        if (!resStart || !resEnd) continue;
        
        resStart.setHours(0, 0, 0, 0);
        resEnd.setHours(0, 0, 0, 0);
        
        // Jeśli rezerwacja jest w przyszłości
        if (resStart > today) {
            // Sprawdź czy jest przerwa między obecną datą a początkiem rezerwacji
            const gap = Math.ceil((resStart.getTime() - nextAvailableFrom.getTime()) / (1000 * 60 * 60 * 24));
            
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
                    const dayBeforeRes = new Date(resStart);
                    dayBeforeRes.setDate(dayBeforeRes.getDate() - 1);
                    
                    infoDiv.innerHTML = `
                        <div class="availability-message">
                            <i class="fas fa-info-circle"></i>
                            <span>Auto dostępne od ${formatDateForDisplay(nextAvailableFrom)} do ${formatDateForDisplay(dayBeforeRes)}</span>
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
        today.setHours(0, 0, 0, 0);
        const startDate = parseLocalDate(reservation.startDate);
        const endDate = parseLocalDate(reservation.endDate);
        
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
    
    // Sprawdź uprawnienia
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
    const startDate = parseLocalDate(reservation.startDate);
    const endDate = parseLocalDate(reservation.endDate);
    
    if (startDate && endDate && flatpickrInstance) {
        flatpickrInstance.setDate([startDate, endDate], false);
        
        // Ustaw wartość pola z poprawnym formatowaniem
        const formattedStart = formatDateForDisplay(startDate);
        const formattedEnd = formatDateForDisplay(endDate);
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
        reservations[index].cancelledDate = formatDateForStorage(new Date());
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
    const date = parseLocalDate(dateString);
    if (!date) return 'Nieprawidłowa data';
    
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
        showMessage('message', 'Wybierz zakres dat (kliknij dzień rozpoczęcia i zakończenia)', 'error');
        return;
    }
    
    const startDate = selectedDates[0];
    const endDate = selectedDates[1];
    
    // Użyj znormalizowanych dat (tylko data, bez czasu)
    const normalizedStart = getDateOnly(startDate);
    const normalizedEnd = getDateOnly(endDate);
    
    const diffTime = normalizedEnd.getTime() - normalizedStart.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    if (diffDays > 7) {
        showMessage('message', 'Możesz zarezerwować auto maksymalnie na 7 dni', 'error');
        return;
    }
    
    // Sprawdź dostępność
    const isAvailable = checkCarAvailability(selectedCar, normalizedStart, normalizedEnd, editingReservationId);
    
    if (!isAvailable.available) {
        showMessage('message', `Auto jest już zarezerwowane w wybranym okresie. Konflikt z rezerwacją: ${isAvailable.conflictInfo}`, 'error');
        return;
    }
    
    // ZAPISZ DANE Z POPRAWNĄ DATĄ (lokalną)
    const startDateStr = formatDateForStorage(normalizedStart);
    const endDateStr = formatDateForStorage(normalizedEnd);
    
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
        bookingDate: formatDateForStorage(new Date()),
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

// ===== WALIDACJA REZERWACJI =====
function validateReservations() {
    const conflicts = [];
    
    // Dla każdego auta sprawdź nakładanie się rezerwacji
    CARS.forEach(car => {
        const carReservations = reservations.filter(r => 
            r.carId === car.id && 
            r.status !== 'cancelled'
        ).sort((a, b) => {
            const dateA = parseLocalDate(a.startDate);
            const dateB = parseLocalDate(b.startDate);
            return dateA - dateB;
        });
        
        // Sprawdź każdą parę rezerwacji
        for (let i = 0; i < carReservations.length; i++) {
            for (let j = i + 1; j < carReservations.length; j++) {
                const res1 = carReservations[i];
                const res2 = carReservations[j];
                
                const start1 = parseLocalDate(res1.startDate);
                const end1 = parseLocalDate(res1.endDate);
                const start2 = parseLocalDate(res2.startDate);
                const end2 = parseLocalDate(res2.endDate);
                
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

// ===== RAPORTY I EKSPORT =====
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
        const element = document.createElement('div');
        element.innerHTML = content;
        document.body.appendChild(element);
        
        html2canvas(element).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const imgHeight = canvas.height * imgWidth / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save('raport-rezerwacji.pdf');
            document.body.removeChild(element);
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
        const resDate = parseLocalDate(r.startDate);
        return resDate >= startDate && resDate <= endDate && r.status !== 'cancelled';
    });
    
    report.totalReservations = monthlyReservations.length;
    
    monthlyReservations.forEach(reservation => {
        // Liczba dni
        const start = parseLocalDate(reservation.startDate);
        const end = parseLocalDate(reservation.endDate);
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
    
    // Eksport do PDF
    if (typeof html2canvas !== 'undefined' && typeof jsPDF !== 'undefined') {
        const element = document.createElement('div');
        element.innerHTML = content;
        document.body.appendChild(element);
        
        html2canvas(element).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const imgHeight = canvas.height * imgWidth / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`raport-miesieczny-${report.month}-${report.year}.pdf`);
            document.body.removeChild(element);
        });
    }
}

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

function addPDFLibraries() {
    // Sprawdź czy biblioteki już zostały dodane
    if (window.jspdf && window.html2canvas) return;
    
    // Dodaj jsPDF jeśli nie istnieje
    if (!window.jspdf) {
        const jspdfScript = document.createElement('script');
        jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        jspdfScript.onload = function() {
            console.log('jsPDF załadowany');
        };
        document.head.appendChild(jspdfScript);
    }
    
    // Dodaj html2canvas jeśli nie istnieje
    if (!window.html2canvas) {
        const html2canvasScript = document.createElement('script');
        html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        html2canvasScript.onload = function() {
            console.log('html2canvas załadowany');
        };
        document.head.appendChild(html2canvasScript);
    }
}

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
                const start = parseLocalDate(r.startDate);
                const end = parseLocalDate(r.endDate);
                const current = parseLocalDate(dateStr);
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
            
            const start = parseLocalDate(reservation.startDate);
            const end = parseLocalDate(reservation.endDate);
            const current = parseLocalDate(dateStr);
            
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

// ===== EKSPORT FUNKCJI DO GLOBALNEGO ZAKRESU =====
window.editUserReservation = editUserReservation;
window.deleteUserReservation = deleteUserReservation;
window.cancelUserReservation = cancelUserReservation;
window.exportReservationsToPDF = exportReservationsToPDF;
window.generateMonthlyReports = generateMonthlyReports;
window.exportAllReservationsToExcel = exportAllReservationsToExcel;
window.generateMonthlyReport = generateMonthlyReport;

/* Styl dla strony zarządzania rezerwacjami */

/* Sekcje */
.admin-section {
    margin-bottom: 40px;
}

.filters-section {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    border: 1px solid #e9ecef;
}

.filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin-top: 15px;
}

.filter-group {
    display: flex;
    flex-direction: column;
}

.filter-group label {
    font-weight: 500;
    margin-bottom: 5px;
    color: #495057;
}

.filter-group select,
.filter-group input {
    padding: 8px 12px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 14px;
}

.filter-group select:focus,
.filter-group input:focus {
    outline: none;
    border-color: #80bdff;
    box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

/* Statystyki */
.stats-section {
    margin-bottom: 30px;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-top: 15px;
}

.stat-card {
    background: white;
    border-radius: 8px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 15px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border: 1px solid #e9ecef;
    transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.stat-icon {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 20px;
}

.stat-info h4 {
    margin: 0 0 5px 0;
    font-size: 14px;
    color: #6c757d;
    font-weight: 500;
}

.stat-info p {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: #343a40;
}

/* Tabela */
.table-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    flex-wrap: wrap;
    gap: 10px;
}

.table-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.table-info {
    font-size: 14px;
    color: #6c757d;
}

.table-responsive {
    overflow-x: auto;
    border-radius: 8px;
    border: 1px solid #e9ecef;
    background: white;
}

#reservationsTable {
    width: 100%;
    border-collapse: collapse;
    min-width: 800px;
}

#reservationsTable th {
    background: #f8f9fa;
    padding: 15px 12px;
    text-align: left;
    font-weight: 600;
    color: #495057;
    border-bottom: 2px solid #dee2e6;
    white-space: nowrap;
}

#reservationsTable td {
    padding: 12px;
    border-bottom: 1px solid #e9ecef;
    vertical-align: middle;
}

#reservationsTable tr:hover {
    background-color: #f8f9fa;
}

#reservationsTable tr:last-child td {
    border-bottom: none;
}

/* Komórki tabeli */
.date-range {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.date-range .days-count {
    font-size: 12px;
    color: #6c757d;
    font-style: italic;
}

.purpose-cell {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.purpose-cell:hover {
    white-space: normal;
    overflow: visible;
    position: absolute;
    background: white;
    border: 1px solid #dee2e6;
    padding: 8px;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    z-index: 100;
    max-width: 300px;
}

/* Statusy */
.status-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.status-active {
    background-color: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
}

.status-cancelled {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
}

.status-completed {
    background-color: #cce5ff;
    color: #004085;
    border: 1px solid #b8daff;
}

.status-unknown {
    background-color: #e2e3e5;
    color: #383d41;
    border: 1px solid #d6d8db;
}

/* Przyciski akcji */
.action-buttons {
    display: flex;
    gap: 5px;
}

.btn-edit-small,
.btn-delete-small,
.btn-info-small {
    width: 32px;
    height: 32px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: opacity 0.2s;
}

.btn-edit-small:hover,
.btn-delete-small:hover,
.btn-info-small:hover {
    opacity: 0.8;
}

.btn-edit-small {
    background-color: #17a2b8;
    color: white;
}

.btn-delete-small {
    background-color: #dc3545;
    color: white;
}

.btn-info-small {
    background-color: #6c757d;
    color: white;
}

/* Paginacja */
.pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin-top: 20px;
    padding: 15px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e9ecef;
}

.pagination-btn {
    padding: 8px 16px;
    border: 1px solid #dee2e6;
    background: white;
    color: #495057;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
    background: #007bff;
    color: white;
    border-color: #007bff;
}

.pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.page-numbers {
    display: flex;
    gap: 5px;
}

.page-number {
    width: 36px;
    height: 36px;
    border: 1px solid #dee2e6;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
}

.page-number:hover {
    background: #e9ecef;
}

.page-number.active {
    background: #007bff;
    color: white;
    border-color: #007bff;
}

.page-info {
    margin-left: 15px;
    color: #6c757d;
    font-size: 14px;
}

/* Modal */
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    align-items: center;
    justify-content: center;
}

.modal-content {
    background: white;
    border-radius: 8px;
    max-width: 800px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.confirm-modal {
    max-width: 500px;
}

.modal-header {
    padding: 20px;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-header h3 {
    margin: 0;
    color: #343a40;
}

.close-modal,
.close-confirm-modal {
    font-size: 24px;
    cursor: pointer;
    color: #6c757d;
    transition: color 0.2s;
}

.close-modal:hover,
.close-confirm-modal:hover {
    color: #343a40;
}

.modal-body {
    padding: 20px;
}

.modal-buttons {
    display: flex;
    gap: 10px;
    margin-top: 20px;
}

/* Formularz w modal */
#editReservationForm .form-group {
    margin-bottom: 20px;
}

#editReservationForm label {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
    color: #495057;
}

#editReservationForm input,
#editReservationForm select,
#editReservationForm textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 14px;
}

#editReservationForm textarea {
    resize: vertical;
    min-height: 80px;
}

/* Szczegóły rezerwacji */
.reservation-details {
    display: grid;
    gap: 12px;
    margin-top: 15px;
}

.detail-item {
    display: grid;
    grid-template-columns: 150px 1fr;
    align-items: start;
    gap: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid #f0f0f0;
}

.detail-item:last-child {
    border-bottom: none;
}

.detail-item strong {
    color: #495057;
    font-weight: 600;
}

/* Powiadomienia */
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 4px;
    color: white;
    z-index: 1001;
    animation: slideIn 0.3s ease-out;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.notification.success {
    background: #28a745;
}

.notification.error {
    background: #dc3545;
}

.notification.warning {
    background: #ffc107;
    color: #212529;
}

.notification.info {
    background: #17a2b8;
}

.notification-content {
    display: flex;
    align-items: center;
    gap: 10px;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

/* Responsywność */
@media (max-width: 768px) {
    .filters {
        grid-template-columns: 1fr;
    }
    
    .stats-grid {
        grid-template-columns: 1fr;
    }
    
    .table-controls {
        flex-direction: column;
        align-items: stretch;
    }
    
    .table-actions {
        justify-content: center;
    }
    
    .pagination {
        flex-wrap: wrap;
    }
    
    .modal-content {
        width: 95%;
        margin: 10px;
    }
    
    .detail-item {
        grid-template-columns: 1fr;
        gap: 5px;
    }
}
