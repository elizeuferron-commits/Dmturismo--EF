import React, { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Loader2, AlertTriangle, HelpCircle } from 'lucide-react';

declare global {
  namespace google {
    namespace maps {
      type Polyline = any;
    }
  }
}
declare const google: any;

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY' && API_KEY !== '';

interface RouteDisplayProps {
  origin: string;
  destination: string;
  onRoutesComputed?: (distanceText: string, durationText: string) => void;
}

function RouteDisplay({ origin, destination, onRoutesComputed }: RouteDisplayProps) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !origin || !destination) return;
    
    setLoading(true);
    setErrorMsg(null);

    // Clear previous route
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    routesLib.Route.computeRoutes({
      origin: origin,
      destination: destination,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    })
      .then(({ routes }) => {
        setLoading(false);
        if (routes?.[0]) {
          const route = routes[0];
          const newPolylines = route.createPolylines();
          newPolylines.forEach(p => {
            p.setOptions({
              strokeColor: '#ff6b00',
              strokeOpacity: 0.85,
              strokeWeight: 5,
            });
            p.setMap(map);
          });
          polylinesRef.current = newPolylines;
          
          if (route.viewport) {
            map.fitBounds(route.viewport);
          }

          if (onRoutesComputed) {
            const distanceKm = (route.distanceMeters / 1000).toFixed(1);
            const totalMinutes = Math.round(route.durationMillis / 60000);
            const hrs = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            const durationText = hrs > 0 
              ? `${hrs}h ${mins}min`
              : `${mins}min`;

            onRoutesComputed(`${distanceKm} KM`, durationText);
          }
        } else {
          setErrorMsg('Rota não encontrada ou indisponível.');
        }
      })
      .catch(err => {
        setLoading(false);
        console.error('Erro de roteamento Google Maps:', err);
        
        // Handle specific errors like ApiNotActivatedMapError or billings
        if (err.message?.includes('ApiNotActivatedMapError')) {
          setErrorMsg('API "Maps JavaScript API" não está ativada no seu console.');
        } else {
          setErrorMsg('Erro ao calcular trajeto de viagem.');
        }
      });

    return () => {
      polylinesRef.current.forEach(p => p.setMap(null));
    };
  }, [routesLib, map, origin, destination, onRoutesComputed]);

  if (loading) {
    return (
      <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-zinc-400 z-10 rounded-2xl">
        <Loader2 size={24} className="text-orange-500 animate-spin mb-2" />
        <span className="text-[10px] font-black uppercase tracking-wider">Calculando rota operacional...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="absolute inset-0 bg-zinc-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-10 rounded-2xl">
        <AlertTriangle size={24} className="text-yellow-500 mb-2 animate-bounce" />
        <p className="text-xs font-black text-white uppercase tracking-wider mb-1">Rota não calculada</p>
        <p className="text-[9px] text-zinc-500 font-bold uppercase max-w-[240px] leading-relaxed">
          Verifique a ortografia de {origin.toUpperCase()} e {destination.toUpperCase()} ou se a chave possui faturamento ativo.
        </p>
      </div>
    );
  }

  return null;
}

interface RouteMapProps {
  origin: string;
  destination: string;
}

export function RouteMap({ origin, destination }: RouteMapProps) {
  const [metrics, setMetrics] = useState<{ distance: string; duration: string } | null>(null);

  if (!hasValidKey) {
    return (
      <div className="w-full bg-zinc-950 border border-zinc-900 rounded-2xl p-6 flex flex-col items-center justify-center text-center text-zinc-400 my-4 shadow-xl relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-orange-500/5 blur-3xl" />
        <MapPin size={28} className="text-orange-500 mb-3 animate-[pulse_3s_infinite]" />
        <h4 className="text-xs font-black text-white uppercase tracking-widest leading-none mb-1.5 flex items-center gap-1.5">
          Mapas e Rotas em Tempo Real
        </h4>
        <p className="text-[10px] text-zinc-500 font-bold uppercase max-w-sm mb-4 leading-normal">
          Insira uma chave do Google Maps Secrets para visualizar o traçado e distância entre {origin.toUpperCase()} e {destination.toUpperCase()}.
        </p>
        
        <div className="text-left bg-zinc-900/50 border border-zinc-850 p-4 rounded-xl text-[9px] font-bold max-w-sm w-full space-y-2 text-zinc-400 uppercase leading-relaxed">
          <p className="text-[10px] text-white font-black border-b border-zinc-800 pb-1.5 flex items-center gap-1.5">
            <HelpCircle size={10} className="text-orange-500" />
            Como configurar a Chave de API:
          </p>
          <p>
            1. Obtenha uma chave e ative as APIs (Maps JavaScript e Routes) no{' '}
            <a 
              href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-orange-500 hover:underline"
            >
              Google Cloud Console
            </a>
          </p>
          <p>2. Clique em ⚙️ <strong className="text-white">Settings</strong> (topo direito do app)</p>
          <p>
            3. Acesse <strong className="text-white">Secrets</strong> ➔ adicione{' '}
            <code className="text-orange-400 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-800">
              GOOGLE_MAPS_PLATFORM_KEY
            </code>
          </p>
          <p>4. Cole o valor e salve. O app restabelece o mapa automaticamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 space-y-3.5 no-print">
      <div className="flex items-center justify-between">
        <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
          📍 Trajeto Operacional Google Maps
        </h4>
        {metrics && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black px-2 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-lg tabular-nums">
              Distância: {metrics.distance}
            </span>
            <span className="text-[10px] font-black px-2 py-1 bg-zinc-800 border border-zinc-750 text-white rounded-lg tabular-nums">
              Tempo Estimado: {metrics.duration}
            </span>
          </div>
        )}
      </div>

      <div className="w-full h-80 rounded-2xl border border-zinc-800 overflow-hidden bg-zinc-950 relative shadow-inner">
        <APIProvider apiKey={API_KEY} version="weekly" language="pt-BR">
          <Map
            defaultCenter={{ lat: -23.55052, lng: -46.633308 }} // Default context center (São Paulo)
            defaultZoom={11}
            mapId="DM_TURISMO_MAP_VIEW"
            gestureHandling="cooperative"
            disableDefaultUI={true}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            <RouteDisplay 
              origin={origin} 
              destination={destination} 
              onRoutesComputed={(distance, duration) => {
                setMetrics({ distance, duration });
              }}
            />
          </Map>
        </APIProvider>
      </div>
    </div>
  );
}
