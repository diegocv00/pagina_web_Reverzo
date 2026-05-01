import React, { useState, useMemo } from 'react';
import { COLOMBIA_CITIES, City } from '../lib/colombiaCities';

export default function ShippingCalculator() {
    const [origen, setOrigen] = useState<City | null>(null);
    const [destino, setDestino] = useState<City | null>(null);
    const [peso, setPeso] = useState('1'); // Peso estimado de un libro en Kg
    const [largo, setLargo] = useState('');
    const [ancho, setAncho] = useState('');
    const [alto, setAlto] = useState('');
    const [valorDeclarado, setValorDeclarado] = useState('');
    const [costoEstimado, setCostoEstimado] = useState<number | null>(null);

    const [modalVisible, setModalVisible] = useState(false);
    const [selectingType, setSelectingType] = useState<'origen' | 'destino'>('origen');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCities = useMemo(() => {
        if (!searchQuery) return COLOMBIA_CITIES;
        const query = searchQuery.toLowerCase();
        return COLOMBIA_CITIES.filter(city =>
            city.name.toLowerCase().includes(query) ||
            city.department.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    const selectCity = (city: City) => {
        if (selectingType === 'origen') {
            setOrigen(city);
        } else {
            setDestino(city);
        }
        setModalVisible(false);
        setSearchQuery('');
    };

    const calcularEnvio = () => {
        if (!origen || !destino) {
            alert('Por favor, selecciona las ciudades de origen y destino.');
            return;
        }

        if (!largo || !ancho || !alto) {
            alert('Por favor, ingresa las dimensiones del paquete (Largo, Ancho, Alto).');
            return;
        }

        if (!valorDeclarado) {
            alert('Por favor, ingresa el valor declarado del paquete.');
            return;
        }

        const origenDepto = origen.department;
        const origenCiudad = origen.name;
        const destinoDepto = destino.department;
        const destinoCiudad = destino.name;

        // Cálculo de peso final
        let pesoFinal = parseFloat(peso) || 1;
        const pesoVolumetrico = (parseFloat(largo) * parseFloat(ancho) * parseFloat(alto)) / 4500;
        if (pesoVolumetrico > pesoFinal) {
            pesoFinal = pesoVolumetrico;
        }

        let tarifaBase = 0;
        let costoKiloAdicional = 0;

        const trayectosEspeciales = ['Amazonas', 'San Andrés y Providencia', 'Guainía', 'Vaupés', 'Vichada', 'Putumayo'];

        if (trayectosEspeciales.includes(destinoDepto) || trayectosEspeciales.includes(origenDepto)) {
            tarifaBase = 34000;
            costoKiloAdicional = 11000;
        } else if (origenCiudad.toLowerCase() === destinoCiudad.toLowerCase() && origenDepto === destinoDepto) {
            tarifaBase = 7900;
            costoKiloAdicional = 3400;
        } else if (origenDepto === destinoDepto) {
            tarifaBase = 10500;
            costoKiloAdicional = 3900;
        } else {
            tarifaBase = 16950;
            costoKiloAdicional = 4250;
        }

        let tarifaFinal = tarifaBase;

        if (pesoFinal > 1) {
            tarifaFinal += (Math.ceil(pesoFinal) - 1) * costoKiloAdicional;
        }

        let valorDecNum = parseFloat(valorDeclarado.replace(/[^0-9]/g, '')) || 0;
        const minimoDeclarado = (trayectosEspeciales.includes(destinoDepto) || trayectosEspeciales.includes(origenDepto)) ? 50000 : 30000;

        if (valorDecNum < minimoDeclarado) {
            valorDecNum = minimoDeclarado;
        }

        let sobreflete = valorDecNum * 0.02;
        const sobrefleteMinimo = 600;

        if (sobreflete < sobrefleteMinimo) {
            sobreflete = sobrefleteMinimo;
        }

        tarifaFinal += sobreflete;

        setCostoEstimado(tarifaFinal);
    };

    return (
        <div className="bg-card rounded-3xl p-8 border border-border mt-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-text mb-2">Origen</label>
                        <button 
                            onClick={() => { setSelectingType('origen'); setModalVisible(true); }}
                            className="w-full flex justify-between items-center px-4 py-3 bg-bg border border-border rounded-xl focus:border-primary text-left"
                        >
                            <span className={origen ? 'text-text' : 'text-muted'}>
                                {origen ? `${origen.name} - ${origen.department}` : 'Selecciona ciudad'}
                            </span>
                            <span className="material-icons text-muted">arrow_drop_down</span>
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-text mb-2">Destino</label>
                        <button 
                            onClick={() => { setSelectingType('destino'); setModalVisible(true); }}
                            className="w-full flex justify-between items-center px-4 py-3 bg-bg border border-border rounded-xl focus:border-primary text-left"
                        >
                            <span className={destino ? 'text-text' : 'text-muted'}>
                                {destino ? `${destino.name} - ${destino.department}` : 'Selecciona ciudad'}
                            </span>
                            <span className="material-icons text-muted">arrow_drop_down</span>
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-text mb-2">Dimensiones del paquete (cm)</label>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-xs text-muted mb-1 block">Largo</label>
                                <input type="number" value={largo} onChange={(e) => setLargo(e.target.value)} placeholder="0" className="w-full px-4 py-2 bg-bg border border-border rounded-xl focus:border-primary outline-none" />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-muted mb-1 block">Ancho</label>
                                <input type="number" value={ancho} onChange={(e) => setAncho(e.target.value)} placeholder="0" className="w-full px-4 py-2 bg-bg border border-border rounded-xl focus:border-primary outline-none" />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-muted mb-1 block">Alto</label>
                                <input type="number" value={alto} onChange={(e) => setAlto(e.target.value)} placeholder="0" className="w-full px-4 py-2 bg-bg border border-border rounded-xl focus:border-primary outline-none" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-text mb-2">Peso del paquete (kg)</label>
                        <input type="number" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="1" className="w-full px-4 py-3 bg-bg border border-border rounded-xl focus:border-primary outline-none" />
                        <p className="text-xs text-muted mt-1 tracking-wide">Un libro promedio pesa 0.5 - 1kg</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-text mb-2">Valor declarado ($ COP)</label>
                        <input type="number" value={valorDeclarado} onChange={(e) => setValorDeclarado(e.target.value)} placeholder="0" className="w-full px-4 py-3 bg-bg border border-border rounded-xl focus:border-primary outline-none" />
                        <p className="text-xs text-muted mt-1 tracking-wide">Valor comercial de los libros a enviar.</p>
                    </div>

                    <button 
                        onClick={calcularEnvio}
                        className="w-full bg-primary hover:bg-primary-dark transition-colors text-white font-bold py-3 px-6 rounded-xl shadow-sm text-center"
                    >
                        Calcular Tarifa
                    </button>
                </div>

            </div>

            {costoEstimado !== null && (
                <div className="mt-8 p-6 bg-primary/10 rounded-2xl border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h4 className="font-bold text-primary text-xl">Costo estimado:</h4>
                        <p className="text-sm text-muted">Tarifa aproximada basada en Servientrega Colombia.</p>
                    </div>
                    <div className="text-3xl font-bold text-primary">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(costoEstimado)}
                    </div>
                </div>
            )}

            {/* Modal */}
            {modalVisible && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
                    <div className="bg-card rounded-3xl w-full max-w-md overflow-hidden flex flex-col h-[600px]">
                        <div className="p-4 border-b border-border bg-bg/50 flex justify-between items-center">
                            <h3 className="font-bold text-text">Seleccionar ciudad</h3>
                            <button onClick={() => setModalVisible(false)} className="text-muted hover:text-danger"><span className="material-icons">close</span></button>
                        </div>
                        <div className="p-4 border-b border-border">
                            <div className="flex items-center bg-bg rounded-xl border border-border px-4 py-2">
                                <span className="material-icons text-muted mr-2">search</span>
                                <input 
                                    type="text" 
                                    placeholder="Buscar por ciudad o departamento..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-transparent outline-none flex-1 text-sm text-text"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {filteredCities.map((city, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => selectCity(city)}
                                    className="w-full text-left p-4 border-b border-border hover:bg-bg transition-colors flex flex-col"
                                >
                                    <span className="font-bold text-text text-sm">{city.name}</span>
                                    <span className="text-xs text-muted">{city.department}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
