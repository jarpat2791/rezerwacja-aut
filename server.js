const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routing
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint dla rezerwacji (proxy do Google Apps Script)
app.post('/api/reservations', async (req, res) => {
    try {
        // Tutaj dodaj kod do przesyłania danych do Google Apps Script
        // const response = await fetch(GOOGLE_SCRIPT_URL, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(req.body)
        // });
        // const data = await response.json();
        // res.json(data);
        
        // Symulacja odpowiedzi
        res.json({
            success: true,
            message: 'Rezerwacja zapisana pomyślnie',
            reservationId: 'RES-' + Date.now()
        });
    } catch (error) {
        console.error('Błąd API:', error);
        res.status(500).json({ success: false, error: 'Błąd serwera' });
    }
});

// Uruchomienie serwera
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
    console.log(`Otwórz przeglądarkę i przejdź do: http://localhost:${PORT}`);
});