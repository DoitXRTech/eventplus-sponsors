import React from 'react';
import { createRoot } from 'react-dom/client';
// Fuentes servidas desde la app (OFL), sin pedirlas a Google en cada carga.
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/geist';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
