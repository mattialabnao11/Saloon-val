import React, { useState, useEffect } from 'react';

// ========== CONFIGURAZIONE ==========
const API_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');

// ========== UTILITIES ==========
const fetchAPI = async (url, options = {}) => {
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore del server');
  }
  
  return response.json();
};

// ========== APP PRINCIPALE ==========
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('listino');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const data = await fetchAPI('/api/me');
      setUser(data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (nome, password) => {
    const data = await fetchAPI('/api/login', {
      method: 'POST',
      body: JSON.stringify({ nome, password }),
    });
    setUser(data);
    setCurrentPage('listino');
  };

  const handleLogout = async () => {
    await fetchAPI('/api/logout', { method: 'POST' });
    setUser(null);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loader}></div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div style={styles.appContainer}>
      <Sidebar
        user={user}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onLogout={handleLogout}
      />
      <MainContent currentPage={currentPage} user={user} />
    </div>
  );
}

// ========== LOGIN PAGE ==========
function LoginPage({ onLogin }) {
  const [nome, setNome] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onLogin(nome, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.loginContainer}>
      <div style={styles.loginBox}>
        <h1 style={styles.loginTitle}>Gestione Ristorante</h1>
        <p style={styles.loginSubtitle}>Accedi al sistema</p>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.loginForm}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              style={styles.input}
              required
              autoFocus
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <button type="submit" style={styles.loginButton} disabled={loading}>
            {loading ? 'Accesso...' : 'Accedi'}
          </button>
        </form>

        <div style={styles.loginHint}>
          <small>Utente default: Admin / admin123</small>
        </div>
      </div>
    </div>
  );
}

// ========== SIDEBAR ==========
function Sidebar({ user, currentPage, onNavigate, onLogout }) {
  const menuItems = [
    { id: 'listino', label: 'Listino', icon: '📋', allowed: ['Direttore', 'Dipendente'] },
    { id: 'fatture', label: 'Fatture', icon: '🧾', allowed: ['Direttore', 'Dipendente'] },
    { id: 'piatti', label: 'Gestione Piatti', icon: '🍝', allowed: ['Direttore'] },
    { id: 'dipendenti', label: 'Gestione Dipendenti', icon: '👥', allowed: ['Direttore'] },
    { id: 'listini-ranch', label: 'Listini Ranch', icon: '🏪', allowed: ['Direttore'] },
  ];

  return (
    <div style={styles.sidebar}>
      <div style={styles.sidebarHeader}>
        <h2 style={styles.sidebarTitle}>🍴 Ristorante</h2>
        <div style={styles.userInfo}>
          <span style={styles.userName}>{user.nome}</span>
          <span style={styles.userRole}>{user.ruolo}</span>
        </div>
      </div>

      <nav style={styles.nav}>
        {menuItems
          .filter((item) => item.allowed.includes(user.ruolo))
          .map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                ...styles.navItem,
                ...(currentPage === item.id ? styles.navItemActive : {}),
              }}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
      </nav>

      <button onClick={onLogout} style={styles.logoutButton}>
        🚪 Esci
      </button>
    </div>
  );
}

// ========== MAIN CONTENT ==========
function MainContent({ currentPage, user }) {
  return (
    <div style={styles.mainContent}>
      {currentPage === 'listino' && <ListinoPage />}
      {currentPage === 'fatture' && <FatturePage />}
      {currentPage === 'piatti' && <GestionePiattiPage />}
      {currentPage === 'dipendenti' && <GestioneDipendentiPage />}
      {currentPage === 'listini-ranch' && <ListiniRanchPage />}
    </div>
  );
}

// ========== LISTINO PAGE ==========
function ListinoPage() {
  const [piatti, setPiatti] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPiatti();
  }, []);

  const loadPiatti = async () => {
    try {
      const data = await fetchAPI('/api/piatti');
      setPiatti(data);
    } catch (error) {
      console.error('Errore caricamento piatti:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={styles.loading}>Caricamento...</div>;

  return (
    <div style={styles.pageContainer}>
      <h1 style={styles.pageTitle}>📋 Listino Piatti</h1>

      <div style={styles.cardGrid}>
        {piatti.map((piatto) => (
          <div key={piatto.id} style={styles.listinoCard}>
            <div style={styles.listinoCardHeader}>
              <h3 style={styles.listinoCardTitle}>{piatto.nome}</h3>
              <span style={styles.listinoCardPrice}>€{parseFloat(piatto.prezzo).toFixed(2)}</span>
            </div>
            {piatto.ingredienti && piatto.ingredienti.length > 0 && (
              <div style={styles.ingredientiSection}>
                <p style={styles.ingredientiLabel}>Ingredienti necessari:</p>
                <ul style={styles.ingredientiList}>
                  {piatto.ingredienti.map((ing, idx) => (
                    <li key={idx} style={styles.ingredienteItem}>
                      {ing.nome_ingrediente} - {ing.quantita}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {piatti.length === 0 && (
        <div style={styles.emptyState}>Nessun piatto disponibile</div>
      )}
    </div>
  );
}

// ========== GESTIONE PIATTI PAGE ==========
function GestionePiattiPage() {
  const [piatti, setPiatti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPiatto, setEditingPiatto] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadPiatti();
  }, []);

  const loadPiatti = async () => {
    try {
      const data = await fetchAPI('/api/piatti');
      setPiatti(data);
    } catch (error) {
      console.error('Errore caricamento piatti:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo piatto?')) return;

    try {
      await fetchAPI(`/api/piatti/${id}`, { method: 'DELETE' });
      loadPiatti();
    } catch (error) {
      alert('Errore: ' + error.message);
    }
  };

  const handleEdit = (piatto) => {
    setEditingPiatto(piatto);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingPiatto(null);
    loadPiatti();
  };

  if (loading) return <div style={styles.loading}>Caricamento...</div>;

  return (
    <div style={styles.pageContainer}>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>🍝 Gestione Piatti</h1>
        <button
          onClick={() => setShowForm(true)}
          style={styles.primaryButton}
        >
          + Nuovo Piatto
        </button>
      </div>

      {showForm && (
        <PiattoForm
          piatto={editingPiatto}
          onClose={handleFormClose}
        />
      )}

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <div style={styles.tableCell}>Nome</div>
          <div style={styles.tableCell}>Prezzo</div>
          <div style={styles.tableCell}>Ingredienti</div>
          <div style={styles.tableCell}>Azioni</div>
        </div>
        {piatti.map((piatto) => (
          <div key={piatto.id} style={styles.tableRow}>
            <div style={styles.tableCell}>{piatto.nome}</div>
            <div style={styles.tableCell}>€{parseFloat(piatto.prezzo).toFixed(2)}</div>
            <div style={styles.tableCell}>
              {piatto.ingredienti?.length || 0} ingredienti
            </div>
            <div style={styles.tableCell}>
              <button
                onClick={() => handleEdit(piatto)}
                style={styles.editButton}
                className="editButton"
              >
                ✏️
              </button>
              <button
                onClick={() => handleDelete(piatto.id)}
                style={styles.deleteButton}
                className="deleteButton"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {piatti.length === 0 && (
        <div style={styles.emptyState}>Nessun piatto disponibile</div>
      )}
    </div>
  );
}

// ========== PIATTO FORM ==========
function PiattoForm({ piatto, onClose }) {
  const [nome, setNome] = useState(piatto?.nome || '');
  const [prezzo, setPrezzo] = useState(piatto?.prezzo || '');
  const [ingredienti, setIngredienti] = useState(piatto?.ingredienti || []);
  const [loading, setLoading] = useState(false);

  const addIngrediente = () => {
    setIngredienti([...ingredienti, { nome_ingrediente: '', quantita: '' }]);
  };

  const removeIngrediente = (index) => {
    setIngredienti(ingredienti.filter((_, i) => i !== index));
  };

  const updateIngrediente = (index, field, value) => {
    const newIngredienti = [...ingredienti];
    newIngredienti[index][field] = value;
    setIngredienti(newIngredienti);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const body = {
        nome,
        prezzo: parseFloat(prezzo),
        ingredienti: ingredienti.filter(
          (ing) => ing.nome_ingrediente && ing.quantita
        ),
      };

      if (piatto) {
        await fetchAPI(`/api/piatti/${piatto.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await fetchAPI('/api/piatti', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      onClose();
    } catch (error) {
      alert('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.modal}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>
            {piatto ? 'Modifica Piatto' : 'Nuovo Piatto'}
          </h2>
          <button onClick={onClose} style={styles.closeButton} className="closeButton">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Nome Piatto *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Prezzo (€) *</label>
            <input
              type="number"
              step="0.01"
              value={prezzo}
              onChange={(e) => setPrezzo(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <div style={styles.labelRow}>
              <label style={styles.label}>Ingredienti</label>
              <button
                type="button"
                onClick={addIngrediente}
                style={styles.smallButton}
              >
                + Aggiungi
              </button>
            </div>
            {ingredienti.map((ing, index) => (
              <div key={index} style={styles.ingredienteRow} className="ingredienteRow">
                <input
                  type="text"
                  placeholder="Nome ingrediente"
                  value={ing.nome_ingrediente}
                  onChange={(e) =>
                    updateIngrediente(index, 'nome_ingrediente', e.target.value)
                  }
                  style={{ ...styles.input, flex: 2 }}
                />
                <input
                  type="text"
                  placeholder="Quantità"
                  value={ing.quantita}
                  onChange={(e) =>
                    updateIngrediente(index, 'quantita', e.target.value)
                  }
                  style={{ ...styles.input, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => removeIngrediente(index)}
                  style={styles.removeButton}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>

          <div style={styles.formActions}>
            <button
              type="button"
              onClick={onClose}
              style={styles.secondaryButton}
            >
              Annulla
            </button>
            <button
              type="submit"
              style={styles.primaryButton}
              disabled={loading}
            >
              {loading ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========== GESTIONE DIPENDENTI PAGE ==========
function GestioneDipendentiPage() {
  const [dipendenti, setDipendenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingDipendente, setEditingDipendente] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadDipendenti();
  }, []);

  const loadDipendenti = async () => {
    try {
      const data = await fetchAPI('/api/dipendenti');
      setDipendenti(data);
    } catch (error) {
      console.error('Errore caricamento dipendenti:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo dipendente?')) return;

    try {
      await fetchAPI(`/api/dipendenti/${id}`, { method: 'DELETE' });
      loadDipendenti();
    } catch (error) {
      alert('Errore: ' + error.message);
    }
  };

  const handleEdit = (dipendente) => {
    setEditingDipendente(dipendente);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingDipendente(null);
    loadDipendenti();
  };

  if (loading) return <div style={styles.loading}>Caricamento...</div>;

  return (
    <div style={styles.pageContainer}>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>👥 Gestione Dipendenti</h1>
        <button
          onClick={() => setShowForm(true)}
          style={styles.primaryButton}
        >
          + Nuovo Dipendente
        </button>
      </div>

      {showForm && (
        <DipendenteForm
          dipendente={editingDipendente}
          onClose={handleFormClose}
        />
      )}

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <div style={styles.tableCell}>Nome</div>
          <div style={styles.tableCell}>Ruolo</div>
          <div style={styles.tableCell}>Azioni</div>
        </div>
        {dipendenti.map((dipendente) => (
          <div key={dipendente.id} style={styles.tableRow}>
            <div style={styles.tableCell}>{dipendente.nome}</div>
            <div style={styles.tableCell}>
              <span style={styles.roleBadge}>{dipendente.ruolo}</span>
            </div>
            <div style={styles.tableCell}>
              <button
                onClick={() => handleEdit(dipendente)}
                style={styles.editButton}
                className="editButton"
              >
                ✏️
              </button>
              <button
                onClick={() => handleDelete(dipendente.id)}
                style={styles.deleteButton}
                className="deleteButton"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {dipendenti.length === 0 && (
        <div style={styles.emptyState}>Nessun dipendente disponibile</div>
      )}
    </div>
  );
}

// ========== DIPENDENTE FORM ==========
function DipendenteForm({ dipendente, onClose }) {
  const [nome, setNome] = useState(dipendente?.nome || '');
  const [ruolo, setRuolo] = useState(dipendente?.ruolo || 'Dipendente');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const body = { nome, ruolo, password };

      if (dipendente) {
        await fetchAPI(`/api/dipendenti/${dipendente.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await fetchAPI('/api/dipendenti', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      onClose();
    } catch (error) {
      alert('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.modal}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>
            {dipendente ? 'Modifica Dipendente' : 'Nuovo Dipendente'}
          </h2>
          <button onClick={onClose} style={styles.closeButton} className="closeButton">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Nome *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Ruolo *</label>
            <select
              value={ruolo}
              onChange={(e) => setRuolo(e.target.value)}
              style={styles.input}
              required
            >
              <option value="Dipendente">Dipendente</option>
              <option value="Direttore">Direttore</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Password {dipendente ? '(lascia vuoto per non modificare)' : '*'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required={!dipendente}
            />
          </div>

          <div style={styles.formActions}>
            <button
              type="button"
              onClick={onClose}
              style={styles.secondaryButton}
            >
              Annulla
            </button>
            <button
              type="submit"
              style={styles.primaryButton}
              disabled={loading}
            >
              {loading ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========== FATTURE PAGE ==========
function FatturePage() {
  const [fatture, setFatture] = useState([]);
  const [piatti, setPiatti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [fattureData, piattiData] = await Promise.all([
        fetchAPI('/api/fatture'),
        fetchAPI('/api/piatti'),
      ]);
      setFatture(fattureData);
      setPiatti(piattiData);
    } catch (error) {
      console.error('Errore caricamento dati:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    loadData();
  };

  if (loading) return <div style={styles.loading}>Caricamento...</div>;

  return (
    <div style={styles.pageContainer}>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>🧾 Fatture</h1>
        <button
          onClick={() => setShowForm(true)}
          style={styles.primaryButton}
        >
          + Nuova Fattura
        </button>
      </div>

      {showForm && (
        <FatturaForm piatti={piatti} onClose={handleFormClose} />
      )}

      <div style={styles.fattureList}>
        {fatture.map((fattura) => (
          <div key={fattura.id} style={styles.fatturaCard}>
            <div style={styles.fatturaHeader}>
              <div>
                <div style={styles.fatturaId}>Fattura #{fattura.id}</div>
                <div style={styles.fatturaDate}>
                  {new Date(fattura.data).toLocaleString('it-IT')}
                </div>
                <div style={styles.fatturaDipendente}>
                  Creata da: {fattura.dipendente_nome}
                </div>
              </div>
              <div style={styles.fatturaTotal}>
                €{parseFloat(fattura.totale).toFixed(2)}
              </div>
            </div>

            <div style={styles.fatturaDettagli}>
              {fattura.dettagli.map((det, idx) => (
                <div key={idx} style={styles.fatturaDettaglioRow}>
                  <span>{det.nome_piatto}</span>
                  <span>x{det.quantita}</span>
                  <span>€{parseFloat(det.prezzo_unitario).toFixed(2)}</span>
                  <span style={styles.fatturaDettaglioTotal}>
                    €{(det.quantita * parseFloat(det.prezzo_unitario)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {fattura.note && (
              <div style={styles.fatturaNote}>Note: {fattura.note}</div>
            )}
          </div>
        ))}
      </div>

      {fatture.length === 0 && (
        <div style={styles.emptyState}>Nessuna fattura disponibile</div>
      )}
    </div>
  );
}

// ========== FATTURA FORM ==========
function FatturaForm({ piatti, onClose }) {
  const [items, setItems] = useState([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const addItem = () => {
    setItems([
      ...items,
      { piatto_id: '', nome_piatto: '', prezzo_unitario: 0, quantita: 1 },
    ]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    
    if (field === 'piatto_id') {
      const piatto = piatti.find((p) => p.id === parseInt(value));
      if (piatto) {
        newItems[index] = {
          ...newItems[index],
          piatto_id: piatto.id,
          nome_piatto: piatto.nome,
          prezzo_unitario: parseFloat(piatto.prezzo),
        };
      }
    } else {
      newItems[index][field] = value;
    }
    
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce(
      (sum, item) => sum + item.quantita * item.prezzo_unitario,
      0
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (items.length === 0) {
      alert('Aggiungi almeno un piatto alla fattura');
      return;
    }

    setLoading(true);

    try {
      const body = {
        dettagli: items.map((item) => ({
          piatto_id: item.piatto_id,
          nome_piatto: item.nome_piatto,
          quantita: parseInt(item.quantita),
          prezzo_unitario: parseFloat(item.prezzo_unitario),
        })),
        note,
      };

      await fetchAPI('/api/fatture', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      onClose();
    } catch (error) {
      alert('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.modal}>
      <div style={{ ...styles.modalContent, maxWidth: '700px' }}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Nuova Fattura</h2>
          <button onClick={onClose} style={styles.closeButton} className="closeButton">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <div style={styles.labelRow}>
              <label style={styles.label}>Piatti</label>
              <button
                type="button"
                onClick={addItem}
                style={styles.smallButton}
              >
                + Aggiungi Piatto
              </button>
            </div>
            
            {items.map((item, index) => (
              <div key={index} style={styles.fatturaItemRow}>
                <select
                  value={item.piatto_id}
                  onChange={(e) => updateItem(index, 'piatto_id', e.target.value)}
                  style={{ ...styles.input, flex: 2 }}
                  required
                >
                  <option value="">Seleziona piatto...</option>
                  {piatti.map((piatto) => (
                    <option key={piatto.id} value={piatto.id}>
                      {piatto.nome} - €{parseFloat(piatto.prezzo).toFixed(2)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={item.quantita}
                  onChange={(e) => updateItem(index, 'quantita', e.target.value)}
                  style={{ ...styles.input, flex: 1 }}
                  placeholder="Qtà"
                  required
                />
                <div style={styles.itemTotal}>
                  €{(item.quantita * item.prezzo_unitario).toFixed(2)}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  style={styles.removeButton}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Note (opzionale)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
              placeholder="Aggiungi note..."
            />
          </div>

          <div style={styles.totalSection}>
            <span style={styles.totalLabel}>Totale:</span>
            <span style={styles.totalAmount}>€{calculateTotal().toFixed(2)}</span>
          </div>

          <div style={styles.formActions}>
            <button
              type="button"
              onClick={onClose}
              style={styles.secondaryButton}
            >
              Annulla
            </button>
            <button
              type="submit"
              style={styles.primaryButton}
              disabled={loading}
            >
              {loading ? 'Creazione...' : 'Crea Fattura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========== LISTINI RANCH PAGE ==========
function ListiniRanchPage() {
  const [materiali, setMateriali] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingMateriale, setEditingMateriale] = useState(null);
  const [editingPrezzo, setEditingPrezzo] = useState(null);
  const [showMaterialeForm, setShowMaterialeForm] = useState(false);
  const [showPrezzoForm, setShowPrezzoForm] = useState(false);
  const [selectedMateriale, setSelectedMateriale] = useState(null);

  useEffect(() => {
    loadMateriali();
  }, []);

  const loadMateriali = async () => {
    try {
      const data = await fetchAPI('/api/materiali');
      setMateriali(data);
    } catch (error) {
      console.error('Errore caricamento materiali:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMateriale = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo materiale e tutti i suoi prezzi?')) return;

    try {
      await fetchAPI(`/api/materiali/${id}`, { method: 'DELETE' });
      loadMateriali();
    } catch (error) {
      alert('Errore: ' + error.message);
    }
  };

  const handleDeletePrezzo = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo prezzo?')) return;

    try {
      await fetchAPI(`/api/prezzi-venditori/${id}`, { method: 'DELETE' });
      loadMateriali();
    } catch (error) {
      alert('Errore: ' + error.message);
    }
  };

  const handleEditMateriale = (materiale) => {
    setEditingMateriale(materiale);
    setShowMaterialeForm(true);
  };

  const handleAddPrezzo = (materiale) => {
    setSelectedMateriale(materiale);
    setEditingPrezzo(null);
    setShowPrezzoForm(true);
  };

  const handleEditPrezzo = (materiale, prezzo) => {
    setSelectedMateriale(materiale);
    setEditingPrezzo(prezzo);
    setShowPrezzoForm(true);
  };

  const handleFormClose = () => {
    setShowMaterialeForm(false);
    setShowPrezzoForm(false);
    setEditingMateriale(null);
    setEditingPrezzo(null);
    setSelectedMateriale(null);
    loadMateriali();
  };

  if (loading) return <div style={styles.loading}>Caricamento...</div>;

  return (
    <div style={styles.pageContainer}>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>🏪 Listini Ranch - Confronto Prezzi Fornitori</h1>
        <button
          onClick={() => setShowMaterialeForm(true)}
          style={styles.primaryButton}
        >
          + Nuovo Materiale
        </button>
      </div>

      {showMaterialeForm && (
        <MaterialeForm
          materiale={editingMateriale}
          onClose={handleFormClose}
        />
      )}

      {showPrezzoForm && (
        <PrezzoVenditoreForm
          materiale={selectedMateriale}
          prezzo={editingPrezzo}
          onClose={handleFormClose}
        />
      )}

      <div style={styles.ranchContainer}>
        {materiali.map((materiale) => (
          <div key={materiale.id} style={styles.ranchCard}>
            <div style={styles.ranchCardHeader}>
              <div>
                <h3 style={styles.ranchCardTitle}>{materiale.nome}</h3>
                <p style={styles.ranchCardUnit}>Unità: {materiale.unita_misura}</p>
                {materiale.note && (
                  <p style={styles.ranchCardNote}>{materiale.note}</p>
                )}
              </div>
              <div style={styles.ranchCardActions}>
                <button
                  onClick={() => handleEditMateriale(materiale)}
                  style={styles.editButton}
                  className="editButton"
                  title="Modifica materiale"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDeleteMateriale(materiale.id)}
                  style={styles.deleteButton}
                  className="deleteButton"
                  title="Elimina materiale"
                >
                  🗑️
                </button>
              </div>
            </div>

            <div style={styles.ranchPrezziSection}>
              <div style={styles.ranchPrezziHeader}>
                <h4 style={styles.ranchPrezziTitle}>Prezzi Fornitori</h4>
                <button
                  onClick={() => handleAddPrezzo(materiale)}
                  style={styles.smallButton}
                >
                  + Aggiungi Prezzo
                </button>
              </div>

              {materiale.prezzi_venditori && materiale.prezzi_venditori.length > 0 ? (
                <div style={styles.ranchPrezziList}>
                  {materiale.prezzi_venditori.map((prezzo) => {
                    const isMigliore = parseFloat(prezzo.prezzo) === materiale.prezzo_migliore;
                    
                    return (
                      <div
                        key={prezzo.id}
                        style={{
                          ...styles.ranchPrezzoItem,
                          ...(isMigliore ? styles.ranchPrezzoMigliore : {})
                        }}
                      >
                        <div style={styles.ranchPrezzoInfo}>
                          <div style={styles.ranchPrezzoVenditore}>
                            {prezzo.nome_venditore}
                            {isMigliore && (
                              <span style={styles.ranchBadgeMigliore}>🏆 Migliore</span>
                            )}
                          </div>
                          <div style={styles.ranchPrezzoAmount}>
                            €{parseFloat(prezzo.prezzo).toFixed(2)}/{materiale.unita_misura}
                          </div>
                          {prezzo.note && (
                            <div style={styles.ranchPrezzoNote}>{prezzo.note}</div>
                          )}
                          <div style={styles.ranchPrezzoData}>
                            Aggiornato: {new Date(prezzo.data_aggiornamento).toLocaleDateString('it-IT')}
                          </div>
                        </div>
                        <div style={styles.ranchPrezzoActions}>
                          <button
                            onClick={() => handleEditPrezzo(materiale, prezzo)}
                            style={styles.editButton}
                            className="editButton"
                            title="Modifica prezzo"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeletePrezzo(prezzo.id)}
                            style={styles.deleteButton}
                            className="deleteButton"
                            title="Elimina prezzo"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={styles.ranchNoPrezzi}>
                  Nessun prezzo disponibile. Aggiungi i prezzi dei fornitori per confrontarli.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {materiali.length === 0 && (
        <div style={styles.emptyState}>
          Nessun materiale disponibile. Inizia aggiungendo i materiali che acquisti.
        </div>
      )}
    </div>
  );
}

// ========== MATERIALE FORM ==========
function MaterialeForm({ materiale, onClose }) {
  const [nome, setNome] = useState(materiale?.nome || '');
  const [unitaMisura, setUnitaMisura] = useState(materiale?.unita_misura || '');
  const [note, setNote] = useState(materiale?.note || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const body = { nome, unita_misura: unitaMisura, note };

      if (materiale) {
        await fetchAPI(`/api/materiali/${materiale.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await fetchAPI('/api/materiali', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      onClose();
    } catch (error) {
      alert('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.modal}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>
            {materiale ? 'Modifica Materiale' : 'Nuovo Materiale'}
          </h2>
          <button onClick={onClose} style={styles.closeButton} className="closeButton">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Nome Materiale *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              style={styles.input}
              placeholder="es. Farina 00, Olio EVO, ecc."
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Unità di Misura *</label>
            <input
              type="text"
              value={unitaMisura}
              onChange={(e) => setUnitaMisura(e.target.value)}
              style={styles.input}
              placeholder="es. kg, litri, pezzi, ecc."
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Note (opzionale)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
              placeholder="Informazioni aggiuntive sul materiale..."
            />
          </div>

          <div style={styles.formActions}>
            <button
              type="button"
              onClick={onClose}
              style={styles.secondaryButton}
            >
              Annulla
            </button>
            <button
              type="submit"
              style={styles.primaryButton}
              disabled={loading}
            >
              {loading ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========== PREZZO VENDITORE FORM ==========
function PrezzoVenditoreForm({ materiale, prezzo, onClose }) {
  const [nomeVenditore, setNomeVenditore] = useState(prezzo?.nome_venditore || '');
  const [prezzoValue, setPrezzoValue] = useState(prezzo?.prezzo || '');
  const [note, setNote] = useState(prezzo?.note || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const body = {
        materiale_id: materiale.id,
        nome_venditore: nomeVenditore,
        prezzo: parseFloat(prezzoValue),
        note
      };

      if (prezzo) {
        await fetchAPI(`/api/prezzi-venditori/${prezzo.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await fetchAPI('/api/prezzi-venditori', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      onClose();
    } catch (error) {
      alert('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.modal}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>
            {prezzo ? 'Modifica Prezzo' : 'Nuovo Prezzo'}
          </h2>
          <button onClick={onClose} style={styles.closeButton} className="closeButton">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Materiale</label>
            <div style={styles.ranchMaterialeInfo}>
              <strong>{materiale.nome}</strong>
              <span style={styles.ranchMaterialeUnit}>({materiale.unita_misura})</span>
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Nome Fornitore *</label>
            <input
              type="text"
              value={nomeVenditore}
              onChange={(e) => setNomeVenditore(e.target.value)}
              style={styles.input}
              placeholder="es. Fornitore A, Grossista XYZ, ecc."
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Prezzo (€/{materiale.unita_misura}) *</label>
            <input
              type="number"
              step="0.01"
              value={prezzoValue}
              onChange={(e) => setPrezzoValue(e.target.value)}
              style={styles.input}
              placeholder="0.00"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Note (opzionale)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
              placeholder="es. Min. ordine, condizioni di pagamento, ecc."
            />
          </div>

          <div style={styles.formActions}>
            <button
              type="button"
              onClick={onClose}
              style={styles.secondaryButton}
            >
              Annulla
            </button>
            <button
              type="submit"
              style={styles.primaryButton}
              disabled={loading}
            >
              {loading ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========== STYLES ==========
const styles = {
  // Global
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  loader: {
    width: '50px',
    height: '50px',
    border: '5px solid rgba(255,255,255,0.3)',
    borderTop: '5px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  
  // Login Page
  loginContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
  },
  loginBox: {
    background: 'white',
    borderRadius: '20px',
    padding: '50px 40px',
    maxWidth: '400px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  loginTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: '32px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '8px',
    textAlign: 'center',
  },
  loginSubtitle: {
    color: '#666',
    textAlign: 'center',
    marginBottom: '30px',
    fontSize: '16px',
  },
  loginForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  loginButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    padding: '14px 24px',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  loginHint: {
    marginTop: '20px',
    textAlign: 'center',
    color: '#999',
  },

  // App Layout
  appContainer: {
    display: 'flex',
    height: '100vh',
    background: '#f5f7fa',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  
  // Sidebar
  sidebar: {
    width: '280px',
    background: 'linear-gradient(180deg, #2c3e50 0%, #34495e 100%)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '4px 0 20px rgba(0,0,0,0.1)',
  },
  sidebarHeader: {
    padding: '30px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  sidebarTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: '24px',
    color: 'white',
    marginBottom: '16px',
    fontWeight: '700',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  userName: {
    color: 'white',
    fontSize: '15px',
    fontWeight: '600',
  },
  userRole: {
    color: '#ecf0f1',
    fontSize: '13px',
    opacity: '0.8',
  },
  nav: {
    flex: 1,
    padding: '20px 0',
  },
  navItem: {
    width: '100%',
    padding: '14px 24px',
    background: 'transparent',
    border: 'none',
    color: '#ecf0f1',
    fontSize: '15px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transition: 'all 0.2s',
    textAlign: 'left',
  },
  navItemActive: {
    background: 'rgba(255,255,255,0.1)',
    borderLeft: '4px solid #3498db',
    color: 'white',
    fontWeight: '600',
  },
  navIcon: {
    fontSize: '20px',
  },
  logoutButton: {
    margin: '20px 24px',
    padding: '12px 24px',
    background: 'rgba(231, 76, 60, 0.2)',
    border: '1px solid rgba(231, 76, 60, 0.4)',
    borderRadius: '8px',
    color: '#e74c3c',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  // Main Content
  mainContent: {
    flex: 1,
    overflow: 'auto',
    background: '#f5f7fa',
  },
  pageContainer: {
    padding: '40px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
  },
  pageTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: '36px',
    color: '#1a1a1a',
    fontWeight: '700',
  },

  // Buttons
  primaryButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    padding: '14px 28px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
  },
  secondaryButton: {
    background: '#f0f2f5',
    color: '#495057',
    border: 'none',
    padding: '14px 28px',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  editButton: {
    background: 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '10px 14px',
    marginRight: '8px',
    borderRadius: '10px',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(253, 203, 110, 0.3)',
  },
  deleteButton: {
    background: 'linear-gradient(135deg, #ff7675 0%, #d63031 100%)',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '10px 14px',
    borderRadius: '10px',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(214, 48, 49, 0.3)',
  },
  smallButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 2px 10px rgba(102, 126, 234, 0.3)',
    transition: 'all 0.2s',
  },
  removeButton: {
    background: 'linear-gradient(135deg, #fab1a0 0%, #ff7675 100%)',
    border: 'none',
    padding: '10px 14px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(255, 118, 117, 0.3)',
  },

  // Forms
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    color: '#1a1a1a',
    fontSize: '14px',
    fontWeight: '600',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  input: {
    width: '100%',
    padding: '14px 18px',
    border: '2px solid #e1e8ed',
    borderRadius: '12px',
    fontSize: '15px',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
    background: '#fafbfc',
  },
  form: {
    padding: '32px',
    maxHeight: 'calc(90vh - 180px)',
    overflowY: 'auto',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: '2px solid #f0f2f5',
  },

  // Table
  table: {
    background: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1.5fr 1fr',
    padding: '16px 24px',
    background: '#f8f9fa',
    fontWeight: '600',
    fontSize: '14px',
    color: '#495057',
    borderBottom: '2px solid #e9ecef',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1.5fr 1fr',
    padding: '16px 24px',
    borderBottom: '1px solid #e9ecef',
    alignItems: 'center',
  },
  tableCell: {
    fontSize: '15px',
    color: '#1a1a1a',
  },

  // Modal
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(8px)',
    animation: 'fadeIn 0.2s ease-out',
  },
  modalContent: {
    background: 'white',
    borderRadius: '24px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 25px 80px rgba(102, 126, 234, 0.3), 0 10px 30px rgba(0,0,0,0.2)',
    animation: 'slideUp 0.3s ease-out',
    border: '1px solid rgba(255,255,255,0.8)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '28px 32px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
  },
  modalTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: '26px',
    color: 'white',
    fontWeight: '700',
    margin: 0,
  },
  closeButton: {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: 'white',
    padding: '8px',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    fontWeight: 'bold',
  },

  // Cards
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '24px',
  },
  listinoCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  listinoCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  listinoCardTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a1a1a',
  },
  listinoCardPrice: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#667eea',
  },
  ingredientiSection: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #e9ecef',
  },
  ingredientiLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#666',
    marginBottom: '8px',
  },
  ingredientiList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  ingredienteItem: {
    fontSize: '14px',
    color: '#1a1a1a',
    padding: '4px 0',
  },

  // Ingredienti Row
  ingredienteRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px',
    alignItems: 'center',
  },

  // Fatture
  fattureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  fatturaCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  fatturaHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '2px solid #e9ecef',
  },
  fatturaId: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '4px',
  },
  fatturaDate: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '4px',
  },
  fatturaDipendente: {
    fontSize: '13px',
    color: '#999',
  },
  fatturaTotal: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#667eea',
  },
  fatturaDettagli: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  fatturaDettaglioRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 0.5fr 1fr 1fr',
    gap: '16px',
    fontSize: '15px',
    color: '#1a1a1a',
    alignItems: 'center',
  },
  fatturaDettaglioTotal: {
    fontWeight: '600',
    textAlign: 'right',
  },
  fatturaNote: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #e9ecef',
    fontSize: '14px',
    color: '#666',
    fontStyle: 'italic',
  },
  fatturaItemRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px',
    alignItems: 'center',
  },
  itemTotal: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#667eea',
    minWidth: '80px',
    textAlign: 'right',
  },
  totalSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    background: '#f8f9fa',
    borderRadius: '8px',
    marginTop: '20px',
  },
  totalLabel: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a1a',
  },
  totalAmount: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#667eea',
  },

  // Misc
  roleBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '600',
    background: '#e0e7ff',
    color: '#667eea',
  },
  errorBox: {
    background: '#fee',
    color: '#c33',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#999',
    fontSize: '16px',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '16px',
    color: '#999',
  },
  
  // Listini Ranch Styles
  ranchContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  ranchCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '28px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    transition: 'all 0.2s',
  },
  ranchCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    paddingBottom: '20px',
    borderBottom: '2px solid #f0f2f5',
  },
  ranchCardTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '8px',
  },
  ranchCardUnit: {
    fontSize: '14px',
    color: '#666',
    fontWeight: '500',
  },
  ranchCardNote: {
    fontSize: '13px',
    color: '#999',
    marginTop: '4px',
    fontStyle: 'italic',
  },
  ranchCardActions: {
    display: 'flex',
    gap: '8px',
  },
  ranchPrezziSection: {
    marginTop: '20px',
  },
  ranchPrezziHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  ranchPrezziTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a1a',
  },
  ranchPrezziList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  ranchPrezzoItem: {
    background: '#f8f9fa',
    borderRadius: '12px',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '2px solid #e9ecef',
    transition: 'all 0.2s',
  },
  ranchPrezzoMigliore: {
    background: 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)',
    border: '2px solid #28a745',
    boxShadow: '0 4px 15px rgba(40, 167, 69, 0.2)',
  },
  ranchPrezzoInfo: {
    flex: 1,
  },
  ranchPrezzoVenditore: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  ranchBadgeMigliore: {
    background: '#28a745',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '700',
  },
  ranchPrezzoAmount: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#667eea',
    marginBottom: '6px',
  },
  ranchPrezzoNote: {
    fontSize: '13px',
    color: '#666',
    marginBottom: '4px',
  },
  ranchPrezzoData: {
    fontSize: '12px',
    color: '#999',
  },
  ranchPrezzoActions: {
    display: 'flex',
    gap: '8px',
  },
  ranchNoPrezzi: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#999',
    fontSize: '15px',
    background: '#f8f9fa',
    borderRadius: '12px',
    border: '2px dashed #dee2e6',
  },
  ranchMaterialeInfo: {
    background: '#f0f2f5',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '15px',
    color: '#1a1a1a',
  },
  ranchMaterialeUnit: {
    color: '#666',
    marginLeft: '8px',
    fontSize: '14px',
  },
};

// CSS Animation for loader
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;600;700&display=swap');
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(30px) scale(0.95);
    }
    to { 
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  button {
    font-family: inherit;
  }
  
  button:hover {
    transform: translateY(-2px);
    filter: brightness(1.05);
  }
  
  button:active {
    transform: translateY(0);
  }
  
  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: #667eea !important;
    background: white !important;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
  }
  
  .listinoCard:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  }
  
  /* Scrollbar personalizzata */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }
  
  ::-webkit-scrollbar-thumb {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 10px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%);
  }
  
  /* Effetto hover per close button */
  .closeButton:hover {
    background: rgba(255,255,255,0.3) !important;
    transform: rotate(90deg) !important;
  }
  
  /* Animazione per ingredienti row */
  .ingredienteRow {
    animation: slideUp 0.2s ease-out;
  }
  
  /* Effetto per edit/delete buttons */
  .editButton:hover {
    transform: scale(1.1) !important;
  }
  
  .deleteButton:hover {
    transform: scale(1.1) !important;
  }
  
  /* Input con effetto */
  input, select, textarea {
    transition: all 0.2s ease !important;
  }
  
  input:hover, select:hover, textarea:hover {
    border-color: #667eea !important;
  }
`;
document.head.appendChild(styleSheet);
