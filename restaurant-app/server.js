const express = require('express');
const session = require('express-session');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configurazione database Neon
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// DEBUG: Log connessione (rimuovere dopo il fix)
console.log('=== DATABASE CONNECTION INFO ===');
console.log('DATABASE_URL presente:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
    // Nascondi la password nel log
    const urlParts = process.env.DATABASE_URL.match(/postgresql:\/\/([^:]+):([^@]+)@([^\/]+)\/(.+)/);
    if (urlParts) {
        console.log('User:', urlParts[1]);
        console.log('Host:', urlParts[3]);
        console.log('Database:', urlParts[4]);
    }
}
console.log('================================');

// Test connessione al database
pool.query('SELECT current_database() as db, current_user as user, version()', (err, result) => {
    if (err) {
        console.error('❌ Errore connessione database:', err.message);
    } else {
        console.log('✅ Connesso a database:', result.rows[0].db);
        console.log('✅ Utente:', result.rows[0].user);
    }
});

// Test conteggio tabelle
pool.query("SELECT COUNT(*) as count FROM users", (err, result) => {
    if (err) {
        console.error('❌ Tabella users non trovata:', err.message);
    } else {
        console.log('✅ Utenti nel database:', result.rows[0].count);
    }
});

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3001',
    credentials: true
}));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'restaurant-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 ore
    }
}));

// Middleware per verificare autenticazione
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Non autenticato' });
    }
    next();
};

// Middleware per verificare ruolo direttore
const requireDirettore = (req, res, next) => {
    if (!req.session.userId || req.session.ruolo !== 'Direttore') {
        return res.status(403).json({ error: 'Accesso negato. Solo i direttori possono accedere.' });
    }
    next();
};

// ============ AUTH ROUTES ============

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { nome, password } = req.body;
        
        const result = await pool.query(
            'SELECT * FROM users WHERE nome = $1 AND password = $2',
            [nome, password]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenziali non valide' });
        }

        const user = result.rows[0];
        req.session.userId = user.id;
        req.session.nome = user.nome;
        req.session.ruolo = user.ruolo;

        res.json({
            id: user.id,
            nome: user.nome,
            ruolo: user.ruolo
        });
    } catch (error) {
        console.error('Errore login:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logout effettuato' });
});

// Check sessione
app.get('/api/me', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Non autenticato' });
    }
    res.json({
        id: req.session.userId,
        nome: req.session.nome,
        ruolo: req.session.ruolo
    });
});

// ============ PIATTI ROUTES ============

// Get tutti i piatti con ingredienti
app.get('/api/piatti', requireAuth, async (req, res) => {
    try {
        const piatti = await pool.query('SELECT * FROM piatti ORDER BY nome');
        
        // Per ogni piatto, prendi gli ingredienti
        const piattiConIngredienti = await Promise.all(
            piatti.rows.map(async (piatto) => {
                const ingredienti = await pool.query(
                    'SELECT * FROM ingredienti WHERE piatto_id = $1',
                    [piatto.id]
                );
                return {
                    ...piatto,
                    ingredienti: ingredienti.rows
                };
            })
        );

        res.json(piattiConIngredienti);
    } catch (error) {
        console.error('Errore get piatti:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Crea nuovo piatto (solo direttore)
app.post('/api/piatti', requireDirettore, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { nome, prezzo, ingredienti } = req.body;

        // Inserisci piatto
        const piattoResult = await client.query(
            'INSERT INTO piatti (nome, prezzo) VALUES ($1, $2) RETURNING *',
            [nome, prezzo]
        );

        const piatto = piattoResult.rows[0];

        // Inserisci ingredienti
        if (ingredienti && ingredienti.length > 0) {
            for (const ing of ingredienti) {
                await client.query(
                    'INSERT INTO ingredienti (piatto_id, nome_ingrediente, quantita) VALUES ($1, $2, $3)',
                    [piatto.id, ing.nome_ingrediente, ing.quantita]
                );
            }
        }

        await client.query('COMMIT');

        // Recupera il piatto completo con ingredienti
        const ingredientiResult = await pool.query(
            'SELECT * FROM ingredienti WHERE piatto_id = $1',
            [piatto.id]
        );

        res.json({
            ...piatto,
            ingredienti: ingredientiResult.rows
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore creazione piatto:', error);
        res.status(500).json({ error: 'Errore del server' });
    } finally {
        client.release();
    }
});

// Modifica piatto (solo direttore)
app.put('/api/piatti/:id', requireDirettore, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { id } = req.params;
        const { nome, prezzo, ingredienti } = req.body;

        // Aggiorna piatto
        await client.query(
            'UPDATE piatti SET nome = $1, prezzo = $2 WHERE id = $3',
            [nome, prezzo, id]
        );

        // Elimina vecchi ingredienti
        await client.query('DELETE FROM ingredienti WHERE piatto_id = $1', [id]);

        // Inserisci nuovi ingredienti
        if (ingredienti && ingredienti.length > 0) {
            for (const ing of ingredienti) {
                await client.query(
                    'INSERT INTO ingredienti (piatto_id, nome_ingrediente, quantita) VALUES ($1, $2, $3)',
                    [id, ing.nome_ingrediente, ing.quantita]
                );
            }
        }

        await client.query('COMMIT');

        // Recupera il piatto aggiornato
        const piattoResult = await pool.query('SELECT * FROM piatti WHERE id = $1', [id]);
        const ingredientiResult = await pool.query(
            'SELECT * FROM ingredienti WHERE piatto_id = $1',
            [id]
        );

        res.json({
            ...piattoResult.rows[0],
            ingredienti: ingredientiResult.rows
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore modifica piatto:', error);
        res.status(500).json({ error: 'Errore del server' });
    } finally {
        client.release();
    }
});

// Elimina piatto (solo direttore)
app.delete('/api/piatti/:id', requireDirettore, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM piatti WHERE id = $1', [id]);
        res.json({ message: 'Piatto eliminato' });
    } catch (error) {
        console.error('Errore eliminazione piatto:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// ============ DIPENDENTI ROUTES ============

// Get tutti i dipendenti (solo direttore)
app.get('/api/dipendenti', requireDirettore, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome, ruolo FROM users ORDER BY nome');
        res.json(result.rows);
    } catch (error) {
        console.error('Errore get dipendenti:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Crea nuovo dipendente (solo direttore)
app.post('/api/dipendenti', requireDirettore, async (req, res) => {
    try {
        const { nome, ruolo, password } = req.body;
        
        const result = await pool.query(
            'INSERT INTO users (nome, ruolo, password) VALUES ($1, $2, $3) RETURNING id, nome, ruolo',
            [nome, ruolo, password]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Errore creazione dipendente:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Modifica dipendente (solo direttore)
app.put('/api/dipendenti/:id', requireDirettore, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, ruolo, password } = req.body;

        const result = await pool.query(
            'UPDATE users SET nome = $1, ruolo = $2, password = $3 WHERE id = $4 RETURNING id, nome, ruolo',
            [nome, ruolo, password, id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Errore modifica dipendente:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Elimina dipendente (solo direttore)
app.delete('/api/dipendenti/:id', requireDirettore, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Non permettere di eliminare se stesso
        if (parseInt(id) === req.session.userId) {
            return res.status(400).json({ error: 'Non puoi eliminare il tuo account' });
        }

        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: 'Dipendente eliminato' });
    } catch (error) {
        console.error('Errore eliminazione dipendente:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// ============ FATTURE ROUTES ============

// Get tutte le fatture
app.get('/api/fatture', requireAuth, async (req, res) => {
    try {
        const fatture = await pool.query(`
            SELECT f.*, u.nome as dipendente_nome 
            FROM fatture f
            LEFT JOIN users u ON f.user_id = u.id
            ORDER BY f.data DESC
        `);

        // Per ogni fattura, prendi i dettagli
        const fattureComplete = await Promise.all(
            fatture.rows.map(async (fattura) => {
                const dettagli = await pool.query(
                    'SELECT * FROM fatture_dettagli WHERE fattura_id = $1',
                    [fattura.id]
                );
                return {
                    ...fattura,
                    dettagli: dettagli.rows
                };
            })
        );

        res.json(fattureComplete);
    } catch (error) {
        console.error('Errore get fatture:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Crea nuova fattura
app.post('/api/fatture', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { dettagli, note } = req.body;

        // Calcola totale
        const totale = dettagli.reduce((sum, item) => {
            return sum + (item.prezzo_unitario * item.quantita);
        }, 0);

        // Inserisci fattura
        const fatturaResult = await client.query(
            'INSERT INTO fatture (totale, user_id, note) VALUES ($1, $2, $3) RETURNING *',
            [totale, req.session.userId, note]
        );

        const fattura = fatturaResult.rows[0];

        // Inserisci dettagli
        for (const item of dettagli) {
            await client.query(
                'INSERT INTO fatture_dettagli (fattura_id, piatto_id, nome_piatto, quantita, prezzo_unitario) VALUES ($1, $2, $3, $4, $5)',
                [fattura.id, item.piatto_id, item.nome_piatto, item.quantita, item.prezzo_unitario]
            );
        }

        await client.query('COMMIT');

        // Recupera fattura completa
        const dettagliResult = await pool.query(
            'SELECT * FROM fatture_dettagli WHERE fattura_id = $1',
            [fattura.id]
        );

        res.json({
            ...fattura,
            dettagli: dettagliResult.rows,
            dipendente_nome: req.session.nome
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore creazione fattura:', error);
        res.status(500).json({ error: 'Errore del server' });
    } finally {
        client.release();
    }
});

// ============ START SERVER ============

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'client/build')));
    
    // Handle React routing, return all requests to React app
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`Server avviato sulla porta ${PORT}`);
});
