-- Schema database per applicazione ristorante

-- Tabella utenti (dipendenti e direttori)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    ruolo VARCHAR(20) NOT NULL CHECK (ruolo IN ('Direttore', 'Dipendente')),
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella piatti
CREATE TABLE IF NOT EXISTS piatti (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    prezzo DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella ingredienti per piatti
CREATE TABLE IF NOT EXISTS ingredienti (
    id SERIAL PRIMARY KEY,
    piatto_id INTEGER REFERENCES piatti(id) ON DELETE CASCADE,
    nome_ingrediente VARCHAR(100) NOT NULL,
    quantita VARCHAR(50) NOT NULL
);

-- Tabella fatture
CREATE TABLE IF NOT EXISTS fatture (
    id SERIAL PRIMARY KEY,
    data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    totale DECIMAL(10, 2) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    note TEXT
);

-- Tabella dettagli fatture
CREATE TABLE IF NOT EXISTS fatture_dettagli (
    id SERIAL PRIMARY KEY,
    fattura_id INTEGER REFERENCES fatture(id) ON DELETE CASCADE,
    piatto_id INTEGER REFERENCES piatti(id),
    nome_piatto VARCHAR(100) NOT NULL,
    quantita INTEGER NOT NULL,
    prezzo_unitario DECIMAL(10, 2) NOT NULL
);

-- Inserimento utente direttore di default (password: admin123)
INSERT INTO users (nome, ruolo, password) 
VALUES ('Admin', 'Direttore', 'admin123')
ON CONFLICT DO NOTHING;
