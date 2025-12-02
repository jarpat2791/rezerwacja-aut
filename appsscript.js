// Skrypt do integracji z Arkuszami Google
// Należy go wdrożyć w Google Apps Script i uzyskać URL wdrożenia

// ID Twojego arkusza Google
const SPREADSHEET_ID = 'TWOJE_ID_ARKUSZA';
const SHEET_NAME = 'Rezerwacje';

// Funkcja do obsługi żądań HTTP
function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        return handleReservation(data);
    } catch (error) {
        return ContentService.createTextOutput(
            JSON.stringify({ success: false, error: error.toString() })
        ).setMimeType(ContentService.MimeType.JSON);
    }
}

function doGet(e) {
    try {
        const action = e.parameter.action;
        
        if (action === 'getReservations') {
            return getReservations();
        } else {
            return ContentService.createTextOutput(
                JSON.stringify({ success: false, error: 'Nieznana akcja' })
            ).setMimeType(ContentService.MimeType.JSON);
        }
    } catch (error) {
        return ContentService.createTextOutput(
            JSON.stringify({ success: false, error: error.toString() })
        ).setMimeType(ContentService.MimeType.JSON);
    }
}

// Obsługa rezerwacji
function handleReservation(data) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    
    // Nagłówki kolumn
    const headers = ['ID', 'Data rezerwacji', 'Login', 'Imię i nazwisko', 'Dział', 
                    'ID auta', 'Nazwa auta', 'Data rozpoczęcia', 'Data zakończenia', 'Cel wyjazdu'];
    
    // Jeśli arkusz jest pusty, dodaj nagłówki
    if (sheet.getLastRow() === 0) {
        sheet.appendRow(headers);
    }
    
    // Sprawdź dostępność auta
    if (!isCarAvailable(data.carId, data.startDate, data.endDate, sheet)) {
        return ContentService.createTextOutput(
            JSON.stringify({ 
                success: false, 
                error: 'Auto jest już zarezerwowane w wybranym terminie' 
            })
        ).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Dodaj nową rezerwację
    const reservationId = 'RES-' + new Date().getTime();
    const newRow = [
        reservationId,
        new Date().toISOString().split('T')[0],
        data.login,
        data.employeeName,
        data.department,
        data.carId,
        data.carName,
        data.startDate,
        data.endDate,
        data.purpose
    ];
    
    sheet.appendRow(newRow);
    
    return ContentService.createTextOutput(
        JSON.stringify({ 
            success: true, 
            message: 'Rezerwacja została zapisana',
            reservationId: reservationId
        })
    ).setMimeType(ContentService.MimeType.JSON);
}

// Sprawdzenie dostępności auta
function isCarAvailable(carId, startDate, endDate, sheet) {
    const data = sheet.getDataRange().getValues();
    
    // Pomijamy nagłówki
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowCarId = row[5]; // Kolumna ID auta
        const rowStartDate = new Date(row[7]); // Data rozpoczęcia
        const rowEndDate = new Date(row[8]); // Data zakończenia
        
        const newStartDate = new Date(startDate);
        const newEndDate = new Date(endDate);
        
        // Jeśli to samo auto
        if (rowCarId === carId) {
            // Sprawdź czy zakresy się nakładają
            if (!(newEndDate < rowStartDate || newStartDate > rowEndDate)) {
                return false; // Auto jest zajęte
            }
        }
    }
    
    return true; // Auto jest dostępne
}

// Pobieranie rezerwacji
function getReservations() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet || sheet.getLastRow() <= 1) {
        return ContentService.createTextOutput(
            JSON.stringify({ reservations: [] })
        ).setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = sheet.getDataRange().getValues();
    const reservations = [];
    
    // Pomijamy nagłówki
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        reservations.push({
            id: row[0],
            bookingDate: row[1],
            login: row[2],
            employeeName: row[3],
            department: row[4],
            carId: row[5],
            carName: row[6],
            startDate: row[7],
            endDate: row[8],
            purpose: row[9]
        });
    }
    
    return ContentService.createTextOutput(
        JSON.stringify({ reservations: reservations })
    ).setMimeType(ContentService.MimeType.JSON);
}