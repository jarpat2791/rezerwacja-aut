// Dane logowania (w rzeczywistości należy użyć bezpiecznego systemu uwierzytelniania)
const VALID_USERS = [
    { login: "pracownik1", password: "haslo123", name: "Jan Kowalski", role: "user", email: "jan.kowalski@firma.pl" },
    { login: "pracownik2", password: "haslo456", name: "Anna Nowak", role: "user", email: "anna.nowak@firma.pl" },
    { login: "pracownik3", password: "haslo789", name: "Piotr Wiśniewski", role: "user", email: "piotr.wisniewski@firma.pl" },
    { login: "admin", password: "admin123", name: "Administrator", role: "admin", email: "admin@firma.pl" }
];

// Dane aut
const CARS = [
    { id: "Auto1", name: "Skoda Octavia 1", plate: "RZ 12345", type: "osobowe" },
    { id: "Auto2", name: "Skoda Octavia 2", plate: "RZ 23456", type: "osobowe" },
    { id: "Auto3", name: "Skoda Octavia 3", plate: "RZ 34567", type: "osobowe" },
    { id: "Auto4", name: "Skoda Superb", plate: "RZ 45678", type: "osobowe" },
    { id: "Auto5", name: "Hyundai Tucson 1", plate: "RZ 56789", type: "osobowe" },
    { id: "Auto6", name: "Hyundai Tucson 2", plate: "RZ 67890", type: "osobowe" }
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

// Funkcje pomocnicze
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

// Obsługa logowania
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

// Obsługa wylogowania
if (document.getElementById('logoutBtn')) {
    document.getElementById('logoutBtn').addEventListener('click', function() {
        clearCurrentUser();
        window.location.href = 'login.html';
    });
}

// Inicjalizacja głównej strony
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
        
        // Dodaj link do zmiany hasła
        addPasswordChangeLink();
        
        // Dodaj link do panelu administracyjnego dla admina
        if (user.role === 'admin' || user.login === 'admin') {
            addAdminPanelLink();
            addReservationsManagementLink();
            addMonthlyReportsLink();
            addMonthCalendarLink();
        }
        
        // Inicjalizuj kalendarz rezerwacji - POPRAWIONA WERSJA
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
        
        // Załaduj dane z Google Sheets (symulacja)
        loadDataFromGoogleSheets();
        
        // Inicjalizuj kalendarz miesiąca jeśli istnieje
        if (document.getElementById('monthCalendar')) {
            initMonthCalendar();
        }
    });
}

// Dodaj link do kalendarza miesiąca
function addMonthCalendarLink() {
    const userInfo = document.querySelector('.user-info');
    if (userInfo) {
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
}

// Dodaj link do raportów miesięcznych
function addMonthlyReportsLink() {
    const userInfo = document.querySelector('.user-info');
    if (userInfo) {
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

// Inicjalizacja kalendarza rezerwacji - POPRAWIONA WERSJA (pojedynczy dzień → zakres)
function initReservationCalendar() {
    flatpickrInstance = flatpickr("#reservationDates", {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: "pl",
        minDate: "today",
        maxDate: new Date().fp_incr(90), // 90 dni do przodu
        disableMobile: true,
        allowInput: false,
        clickOpens: true,
        // WAŻNE: Pozwalamy na wybór pojedynczego dnia
        onReady: function(selectedDates, dateStr, instance) {
            // Dodaj customowy przycisk dla pojedynczego dnia
            const calendarContainer = instance.calendarContainer;
            
            // Dodajemy customową obsługę kliknięć
            instance._bind = instance._bind || instance.bind;
            instance.bind = function(element, event, handler) {
                if (event === 'click' && element.classList.contains('flatpickr-day')) {
                    element.addEventListener('click', function(e) {
                        // Jeśli wybrano już jedną datę, dodaj drugą (tego samego dnia)
                        if (instance.selectedDates.length === 1) {
                            const firstDate = instance.selectedDates[0];
                            instance.setDate([firstDate, firstDate], true);
                            instance.close();
                        } else {
                            // Zacznij nowy zakres
                            instance.clear();
                            instance.setDate([this.dateObj], false);
                        }
                    });
                } else {
                    instance._bind(element, event, handler);
                }
            };
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
                
                // Upewnij się, że daty są poprawnie sformatowane
                const formattedStart = startDate.toISOString().split('T')[0];
                const formattedEnd = endDate.toISOString().split('T')[0];
                console.log('Wybrane daty:', formattedStart, 'do', formattedEnd);
            } else if (selectedDates.length === 1) {
                // Jeśli wybrano tylko jeden dzień, pokaż komunikat
                const selectedDate = selectedDates[0];
                document.getElementById('reservationDates').value = 
                    selectedDate.toISOString().split('T')[0] + ' (kliknij ponownie ten sam dzień)';
            }
        },
        onClose: function(selectedDates, dateStr, instance) {
            // Upewnij się, że data jest poprawnie wyświetlana po zamknięciu kalendarza
            if (selectedDates.length === 2) {
                const startDate = selectedDates[0];
                const endDate = selectedDates[1];
                const formattedStart = startDate.toISOString().split('T')[0];
                const formattedEnd = endDate.toISOString().split('T')[0];
                instance.input.value = `${formattedStart} do ${formattedEnd}`;
            } else if (selectedDates.length === 1) {
                // Jeśli tylko jeden dzień, ustaw jako zakres 1-dniowy
                const singleDate = selectedDates[0];
                instance.setDate([singleDate, singleDate], true);
            }
        }
    });
    
    // Dodaj customową obsługę dla lepszej UX
    const dateInput = document.getElementById('reservationDates');
    if (dateInput) {
        dateInput.addEventListener('click', function() {
            if (flatpickrInstance.selectedDates.length === 1) {
                // Jeśli już wybrano jeden dzień, pokaż instrukcję
                showMessage('message', 'Kliknij ponownie ten sam dzień w kalendarzu, aby zarezerwować na 1 dzień', 'info');
            }
        });
    }
}

// Inicjalizacja kalendarza miesiąca
function initMonthCalendar() {
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
                return current >= start && current <= end;
            });
            
            if (isReserved) {
                dayElem.classList.add('reserved-day');
                dayElem.innerHTML += '<span class="reserved-badge"><i class="fas fa-car"></i></span>';
            }
        },
        onChange: function(selectedDates, dateStr, instance) {
            // Możliwość zaznaczania dni w kalendarzu miesięcznym
            console.log('Wybrane dni w kalendarzu miesięcznym:', selectedDates.length);
        }
    });
    
    // Dodaj przyciski nawigacji
    addMonthCalendarNavigation();
    updateMonthCalendarDisplay();
}

// Dodaj nawigację do kalendarza miesiąca
function addMonthCalendarNavigation() {
    const calendarContainer = document.querySelector('.month-calendar-container');
    if (!calendarContainer) return;
    
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
        monthCalendarInstance.changeMonth(-1);
        updateMonthCalendarDisplay();
    });
    
    document.getElementById('nextMonth').addEventListener('click', function() {
        monthCalendarInstance.changeMonth(1);
        updateMonthCalendarDisplay();
    });
}

// Aktualizuj wyświetlanie kalendarza miesiąca
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

// Oznacz rezerwacje na kalendarzu
function markReservationsOnCalendar() {
    if (!monthCalendarInstance) return;
    
    const calendarDays = document.querySelectorAll('.flatpickr-day');
    calendarDays.forEach(day => {
        day.classList.remove('reserved-day');
        day.classList.remove('reserved-by-user');
        
        const dateStr = day.dateObj.toISOString().split('T')[0];
        
        // Sprawdź rezerwacje dla tego dnia
        reservations.forEach(reservation => {
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

// Pobierz nazwę bieżącego miesiąca
function getCurrentMonthName() {
    const monthNames = [
        'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
        'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    const now = new Date();
    return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
}

// Aktualizacja dostępności w kalendarzu
function updateCalendarAvailability() {
    if (!selectedCar || !flatpickrInstance) return;
    
    // Pobierz rezerwacje dla wybranego auta
    const carReservations = reservations.filter(r => r.carId === selectedCar && r.id !== editingReservationId);
    
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

// Ładowanie rezerwacji
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
                startDate: getDateString(5), // 5 dni od teraz
                endDate: getDateString(7),   // 7 dni od teraz
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
                startDate: getDateString(10), // 10 dni od teraz
                endDate: getDateString(12),   // 12 dni od teraz
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

// Zapisz rezerwacje do localStorage
function saveReservationsToStorage() {
    localStorage.setItem('carReservations', JSON.stringify(reservations));
}

// Pomocnicza funkcja do generowania dat
function getDateString(daysFromNow) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
}

// Wyświetlanie dostępności aut
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

// Pobierz następną dostępną datę dla auta
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

// Wyświetlanie rezerwacji użytkownika
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
        if (user.role === 'admin' || user.login === 'admin') {
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

// Anulowanie rezerwacji przez użytkownika
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

// Edycja rezerwacji użytkownika (dla admina i właściciela rezerwacji)
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
    calendarSection.classList.remove('hidden');
    
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

// Usuwanie rezerwacji użytkownika (dla admina)
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

// Formatowanie daty
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Zatwierdzanie rezerwacji
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
    const carReservations = reservations.filter(r => r.carId === selectedCar && r.id !== editingReservationId && r.status !== 'cancelled');
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

// Resetowanie formularza rezerwacji
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

// Ładowanie danych z Google Sheets
function loadDataFromGoogleSheets() {
    // Symulacja aktualizacji danych co 30 sekund
    setInterval(() => {
        const lastUpdateElement = document.getElementById('lastUpdate');
        if (lastUpdateElement) {
            lastUpdateElement.textContent = `Ostatnia aktualizacja: ${new Date().toLocaleString('pl-PL')}`;
        }
    }, 30000);
}

// Eksport do PDF
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

// Generuj raport miesięczny
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
