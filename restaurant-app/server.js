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

// Verifica connessione database
pool.on('connect', () => {
    console.log('✅ Database connesso');
});

pool.on('error', (err) => {
    console.error('❌ Errore database:', err);
});

// Middleware

// Trust proxy - IMPORTANTE per Render!
app.set('trust proxy', 1);

app.use(cors({
    origin: true, // Accetta tutte le origini in sviluppo/produzione
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['set-cookie']
}));

// Parse requests PRIMA delle sessioni
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurazione sessioni semplificata per Render
app.use(session({
    secret: process.env.SESSION_SECRET || 'restaurant-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'sessionId', // Nome cookie personalizzato
    cookie: {
        secure: 'auto', // Auto-detect HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 ore
        sameSite: 'lax', // Più permissivo
        path: '/'
    },
    rolling: true // Rinnova sessione ad ogni richiesta
}));

// Middleware per verificare autenticazione
const requireAuth = (req, res, next) => {
    console.log('🔐 Check auth - SessionID:', req.sessionID, 'UserID:', req.session.userId);
    
    if (!req.session.userId) {
        console.log('❌ Non autenticato');
        return res.status(401).json({ error: 'Non autenticato' });
    }
    
    console.log('✅ Autenticato:', { userId: req.session.userId, ruolo: req.session.ruolo });
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
        
        console.log('📝 Tentativo login:', nome);
        
        const result = await pool.query(
            'SELECT * FROM users WHERE nome = $1 AND password = $2',
            [nome, password]
        );

        if (result.rows.length === 0) {
            console.log('❌ Login fallito: credenziali non valide');
            return res.status(401).json({ error: 'Credenziali non valide' });
        }

        const user = result.rows[0];
        req.session.userId = user.id;
        req.session.nome = user.nome;
        req.session.ruolo = user.ruolo;

        // Salva sessione esplicitamente
        req.session.save((err) => {
            if (err) {
                console.error('❌ Errore salvataggio sessione:', err);
                return res.status(500).json({ error: 'Errore sessione' });
            }
            
            console.log('✅ Login riuscito:', {
                id: user.id,
                nome: user.nome,
                ruolo: user.ruolo,
                sessionID: req.sessionID
            });
            
            res.json({
                id: user.id,
                nome: user.nome,
                ruolo: user.ruolo
            });
        });
    } catch (error) {
        console.error('❌ Errore login:', error);
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
        
        // Per ogni piatto, prendi gli ingredienti e calcola il costo
        const piattiConIngredienti = await Promise.all(
            piatti.rows.map(async (piatto) => {
                const ingredienti = await pool.query(
                    `SELECT i.*, m.nome as materiale_nome, m.unita_misura
                     FROM ingredienti i
                     LEFT JOIN materiali m ON i.materiale_id = m.id
                     WHERE i.piatto_id = $1`,
                    [piatto.id]
                );
                
                // Calcola costo produzione TOTALE
                let costoTotale = 0;
                
                for (const ing of ingredienti.rows) {
                    if (ing.materiale_id) {
                        // Prendi il prezzo migliore per questo materiale
                        const prezzoMigliore = await pool.query(
                            `SELECT MIN(prezzo) as prezzo_min 
                             FROM prezzi_venditori 
                             WHERE materiale_id = $1`,
                            [ing.materiale_id]
                        );
                        
                        if (prezzoMigliore.rows[0].prezzo_min) {
                            // Estrai il numero dalla quantità (es. "100g" -> 100)
                            const quantitaNumerica = parseFloat(ing.quantita.match(/[\d.]+/)?.[0] || 0);
                            const unitaIngredienti = ing.quantita.match(/[a-zA-Z]+/)?.[0]?.toLowerCase() || '';
                            
                            // Calcolo semplificato: assumiamo che le unità corrispondano
                            // In produzione, dovresti gestire conversioni (g->kg, ml->l, ecc.)
                            let fattoreConversione = 1;
                            
                            // Conversioni base
                            if (unitaIngredienti === 'g' && ing.unita_misura === 'kg') {
                                fattoreConversione = 0.001; // 1g = 0.001kg
                            } else if (unitaIngredienti === 'ml' && ing.unita_misura === 'litri') {
                                fattoreConversione = 0.001; // 1ml = 0.001L
                            }
                            
                            const costoIngrediente = quantitaNumerica * fattoreConversione * parseFloat(prezzoMigliore.rows[0].prezzo_min);
                            costoTotale += costoIngrediente;
                        }
                    }
                }
                
                // Calcola costo PER PORZIONE
                const porzioni = piatto.porzioni || 1;
                const costoPerPorzione = costoTotale / porzioni;
                
                // Calcola margine basato sul costo per porzione
                const margine = costoPerPorzione > 0 ? parseFloat(piatto.prezzo) - costoPerPorzione : null;
                const percentualeMargine = costoPerPorzione > 0 
                    ? ((parseFloat(piatto.prezzo) - costoPerPorzione) / parseFloat(piatto.prezzo) * 100)
                    : null;
                
                return {
                    ...piatto,
                    ingredienti: ingredienti.rows,
                    costo_totale_ricetta: costoTotale > 0 ? costoTotale : null,
                    costo_per_porzione: costoPerPorzione > 0 ? costoPerPorzione : null,
                    margine: margine,
                    percentuale_margine: percentualeMargine
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

        const { nome, prezzo, ingredienti, porzioni } = req.body;

        // Inserisci piatto con porzioni
        const piattoResult = await client.query(
            'INSERT INTO piatti (nome, prezzo, porzioni) VALUES ($1, $2, $3) RETURNING *',
            [nome, prezzo, porzioni || 1]
        );

        const piatto = piattoResult.rows[0];

        // Inserisci ingredienti con materiale_id
        if (ingredienti && ingredienti.length > 0) {
            for (const ing of ingredienti) {
                await client.query(
                    'INSERT INTO ingredienti (piatto_id, nome_ingrediente, quantita, materiale_id) VALUES ($1, $2, $3, $4)',
                    [piatto.id, ing.nome_ingrediente, ing.quantita, ing.materiale_id || null]
                );
            }
        }

        await client.query('COMMIT');

        // Recupera il piatto completo con ingredienti
        const ingredientiResult = await pool.query(
            `SELECT i.*, m.nome as materiale_nome, m.unita_misura
             FROM ingredienti i
             LEFT JOIN materiali m ON i.materiale_id = m.id
             WHERE i.piatto_id = $1`,
            [piatto.id]
        );

        res.json({
            ...piatto,
            ingredienti: ingredientiResult.rows,
            costo_totale_ricetta: null,
            costo_per_porzione: null,
            margine: null
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
        const { nome, prezzo, ingredienti, porzioni_prodotte } = req.body;

        // Aggiorna piatto con porzioni_prodotte
        await client.query(
            'UPDATE piatti SET nome = $1, prezzo = $2, porzioni_prodotte = $3 WHERE id = $4',
            [nome, prezzo, porzioni_prodotte || 1, id]
        );

        // Elimina vecchi ingredienti
        await client.query('DELETE FROM ingredienti WHERE piatto_id = $1', [id]);

        // Inserisci nuovi ingredienti con materiale_id
        if (ingredienti && ingredienti.length > 0) {
            for (const ing of ingredienti) {
                await client.query(
                    'INSERT INTO ingredienti (piatto_id, nome_ingrediente, quantita, materiale_id) VALUES ($1, $2, $3, $4)',
                    [id, ing.nome_ingrediente, ing.quantita, ing.materiale_id || null]
                );
            }
        }

        await client.query('COMMIT');

        // Recupera il piatto aggiornato con costo
        const piattoResult = await pool.query('SELECT * FROM piatti WHERE id = $1', [id]);
        const ingredientiResult = await pool.query(
            `SELECT i.*, m.nome as materiale_nome, m.unita_misura
             FROM ingredienti i
             LEFT JOIN materiali m ON i.materiale_id = m.id
             WHERE i.piatto_id = $1`,
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

// ============ LISTINI RANCH ROUTES ============

// Get tutti i materiali con prezzi venditori
app.get('/api/materiali', requireDirettore, async (req, res) => {
    try {
        const materiali = await pool.query('SELECT * FROM materiali ORDER BY nome');
        
        // Per ogni materiale, prendi i prezzi dei venditori
        const materialiConPrezzi = await Promise.all(
            materiali.rows.map(async (materiale) => {
                const prezzi = await pool.query(
                    'SELECT * FROM prezzi_venditori WHERE materiale_id = $1 ORDER BY prezzo',
                    [materiale.id]
                );
                
                // Trova il prezzo migliore (più basso)
                const prezzoMigliore = prezzi.rows.length > 0 
                    ? Math.min(...prezzi.rows.map(p => parseFloat(p.prezzo)))
                    : null;
                
                return {
                    ...materiale,
                    prezzi_venditori: prezzi.rows,
                    prezzo_migliore: prezzoMigliore
                };
            })
        );

        res.json(materialiConPrezzi);
    } catch (error) {
        console.error('Errore get materiali:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Crea nuovo materiale
app.post('/api/materiali', requireDirettore, async (req, res) => {
    try {
        const { nome, unita_misura, note } = req.body;
        
        const result = await pool.query(
            'INSERT INTO materiali (nome, unita_misura, note) VALUES ($1, $2, $3) RETURNING *',
            [nome, unita_misura, note]
        );

        res.json({
            ...result.rows[0],
            prezzi_venditori: [],
            prezzo_migliore: null
        });
    } catch (error) {
        console.error('Errore creazione materiale:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Modifica materiale
app.put('/api/materiali/:id', requireDirettore, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, unita_misura, note } = req.body;

        const result = await pool.query(
            'UPDATE materiali SET nome = $1, unita_misura = $2, note = $3 WHERE id = $4 RETURNING *',
            [nome, unita_misura, note, id]
        );

        // Recupera i prezzi aggiornati
        const prezzi = await pool.query(
            'SELECT * FROM prezzi_venditori WHERE materiale_id = $1 ORDER BY prezzo',
            [id]
        );

        const prezzoMigliore = prezzi.rows.length > 0 
            ? Math.min(...prezzi.rows.map(p => parseFloat(p.prezzo)))
            : null;

        res.json({
            ...result.rows[0],
            prezzi_venditori: prezzi.rows,
            prezzo_migliore: prezzoMigliore
        });
    } catch (error) {
        console.error('Errore modifica materiale:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Elimina materiale
app.delete('/api/materiali/:id', requireDirettore, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM materiali WHERE id = $1', [id]);
        res.json({ message: 'Materiale eliminato' });
    } catch (error) {
        console.error('Errore eliminazione materiale:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Aggiungi prezzo venditore
app.post('/api/prezzi-venditori', requireDirettore, async (req, res) => {
    try {
        const { materiale_id, nome_venditore, prezzo, note } = req.body;

        const result = await pool.query(
            'INSERT INTO prezzi_venditori (materiale_id, nome_venditore, prezzo, note) VALUES ($1, $2, $3, $4) RETURNING *',
            [materiale_id, nome_venditore, prezzo, note]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Errore aggiunta prezzo:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Modifica prezzo venditore
app.put('/api/prezzi-venditori/:id', requireDirettore, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome_venditore, prezzo, note } = req.body;

        const result = await pool.query(
            'UPDATE prezzi_venditori SET nome_venditore = $1, prezzo = $2, note = $3, data_aggiornamento = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [nome_venditore, prezzo, note, id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Errore modifica prezzo:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Elimina prezzo venditore
app.delete('/api/prezzi-venditori/:id', requireDirettore, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM prezzi_venditori WHERE id = $1', [id]);
        res.json({ message: 'Prezzo eliminato' });
    } catch (error) {
        console.error('Errore eliminazione prezzo:', error);
        res.status(500).json({ error: 'Errore del server' });
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
