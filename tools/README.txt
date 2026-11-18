EL BICHO PICKS · DOCUMENTACIÓN TÉCNICA (versión 17 nov 2026)

ARQUITECTURA (capas)
- Datos: build_data.py (tablas, próximos partidos, registro de pronósticos), stats_fut.txt (goles por liga, local/visitante, forma),
  nations.py (ratings Elo de selecciones y grupos del Mundial 2026). Salida: data.json. Una tarea programada lo actualiza a diario.
- Estadística y modelos: model.py (Python) y app.js/panel.js (navegador) implementan el mismo modelo.
  · Clubes: Poisson con corrección Dixon-Coles (rho = -0.10) y mezcla de 3 niveles de intensidad (sobredispersión).
    Fuerza de ataque/defensa por equipo = mezcla del nivel base de la temporada pasada y los goles de esta temporada
    (peso de la temporada actual = PJ/(PJ+8)), con promedios de local/visitante reales de cada liga.
  · Mercado: cuando SportRadar publica probabilidad, el pronóstico final es 50% modelo + 50% mercado.
    El 50/50 NO está optimizado con datos fuera de muestra (no hay probabilidades de mercado históricas); es una decisión pendiente de validar.
  · Selecciones: Elo (World Football Elo Ratings) -> goles esperados con un modelo log-lineal: λ = exp(log 1.3 ± 0.00434·dr/2),
    dr = diferencia de Elo + 100 si hay localía. El coeficiente 0.00434 se ajustó para reproducir la curva de resultado esperado de Elo.
    Prórroga: λ/3; penales 50/50. El tipo de partido (amistoso, eliminatoria, etc.) NO modifica probabilidades: no hay datos para estimarlo.
  · NBA: diferencia de calificaciones ofensiva/defensiva + 2.4 pts de localía, distribución normal. NFL: series ofensivas con probabilidad de TD/FG.
- Simulación: Monte Carlo (10,000–250,000 por partido; 2,000–25,000 por torneo). Los mercados salen de las simulaciones; las probabilidades exactas del modelo se usan para el ajuste de mercado y la sensibilidad.
- Interfaz: index.html, app.js (selección, resultados), panel.js (incertidumbre, factores, sensibilidad, mapa de calor, métricas, rankings, torneos), live.js (partido animado).
- Evaluación: registro inmutable de pronósticos ("track" en data.json, con versión del modelo y fecha), métricas Log Loss, Brier, RPS, ECE y curva de calibración calculadas en la página.

PRUEBAS
- tests.py: 868 pruebas (probabilidades suman 1, simetría, monotonía, ventaja local, ajuste Elo, redondeo exacto a 100%,
  métricas, normalización de niveles, inmutabilidad de pronósticos históricos). Resultado: 0 fallas.
- Pruebas JS equivalentes (matriz de marcadores, 1X2, redondeo, Elo): 25,210 correctas, 0 fallas.

VALIDACIÓN REAL DISPONIBLE HOY
- Fútbol de clubes: 50 partidos fuera de muestra (jornada del 8 nov 2026). Acierto 60%, Brier 0.527 vs 0.642 de referencia, Log Loss 0.902 vs 1.061.
  Probado contra la versión anterior: usar goles mejora Brier (0.541 -> 0.527). Local/visitante y forma reciente NO mejoraron y se dejaron fuera.
- NFL: 20 partidos fuera de muestra. Acierto 75%.
- Selecciones: SIN validar con históricos todavía.
- Muestras chicas: las cifras pueden variar mucho.

LIMITACIONES Y LO QUE FALTA (no se simula que funcione)
- xG, estadísticas de jugadores, lesiones, sanciones y alineaciones: requieren un proveedor con licencia (p. ej. API-Football, Opta, StatsBomb). No integrados.
- Machine learning (XGBoost, LightGBM, CatBoost, logística multinomial, bayesianos jerárquicos), Elo/Glicko de clubes, Poisson bivariada,
  ensemble con pesos optimizados, calibración isotónica/temperature scaling y validación walk-forward: requieren varios años de resultados
  partido a partido. Fuentes candidatas: football-data.co.uk (clubes, con cuotas) y el conjunto de resultados internacionales de martj42 (selecciones).
  En esta sesión no hay acceso de red para descargarlos; se necesita habilitar internet en la configuración de Claude o subir los archivos CSV.
- Diferencia de puntos de NBA/NFL: no se pudo obtener de las fuentes probadas; se usa el récord de ganados y perdidos.
- Cuadro del Mundial 2026 de 48 equipos: los dieciseisavos siguen el cuadro oficial, pero la asignación de terceros es una aproximación.
- La página es estática (sin backend): las claves de API de pago no deben ir en el navegador; para integrarlas hace falta un servidor.
