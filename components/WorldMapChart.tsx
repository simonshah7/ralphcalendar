'use client';

import { useMemo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Map country names from our data to Natural Earth / world-atlas names
const NAME_MAP: Record<string, string> = {
  'United States': 'United States of America',
  'United Kingdom': 'United Kingdom',
  'Germany': 'Germany',
  'France': 'France',
  'Switzerland': 'Switzerland',
  'Netherlands': 'Netherlands',
  'Denmark': 'Denmark',
  'Sweden': 'Sweden',
  'Finland': 'Finland',
  'Belgium': 'Belgium',
  'Austria': 'Austria',
  'Italy': 'Italy',
  'Spain': 'Spain',
  'Ireland': 'Ireland',
  'Poland': 'Poland',
  'Hungary': 'Hungary',
  'Luxembourg': 'Luxembourg',
  'Saudi Arabia': 'Saudi Arabia',
  'United Arab Emirates': 'United Arab Emirates',
  'Canada': 'Canada',
  'Mexico': 'Mexico',
  'Brazil': 'Brazil',
  'Argentina': 'Argentina',
  'Colombia': 'Colombia',
  'Japan': 'Japan',
  'Australia': 'Australia',
  'Singapore': 'Singapore',
  'India': 'India',
};

const REGION_COLORS: Record<string, string> = {
  Americas: '#3B53FF',
  EMEA: '#7A00C1',
  APAC: '#006170',
  Other: '#94a3b8',
};

const COUNTRY_TO_REGION: Record<string, string> = {
  'United States': 'Americas',
  Canada: 'Americas',
  Mexico: 'Americas',
  Brazil: 'Americas',
  Argentina: 'Americas',
  Colombia: 'Americas',
  'United Kingdom': 'EMEA',
  Germany: 'EMEA',
  France: 'EMEA',
  Switzerland: 'EMEA',
  Netherlands: 'EMEA',
  Denmark: 'EMEA',
  Sweden: 'EMEA',
  Finland: 'EMEA',
  Belgium: 'EMEA',
  Austria: 'EMEA',
  Italy: 'EMEA',
  Spain: 'EMEA',
  Ireland: 'EMEA',
  Poland: 'EMEA',
  Hungary: 'EMEA',
  Luxembourg: 'EMEA',
  'Saudi Arabia': 'EMEA',
  'United Arab Emirates': 'EMEA',
  Japan: 'APAC',
  Australia: 'APAC',
  Singapore: 'APAC',
  India: 'APAC',
};

interface WorldMapChartProps {
  countryDistribution: Record<string, number>;
  totalOpportunities: number;
}

export default function WorldMapChart({
  countryDistribution,
  totalOpportunities,
}: WorldMapChartProps) {
  // Build a reverse lookup: geoName -> { count, country, region }
  const geoLookup = useMemo(() => {
    const map = new Map<
      string,
      { count: number; country: string; region: string }
    >();
    for (const [country, count] of Object.entries(countryDistribution)) {
      const geoName = NAME_MAP[country] || country;
      const region = COUNTRY_TO_REGION[country] || 'Other';
      map.set(geoName, { count, country, region });
    }
    return map;
  }, [countryDistribution]);

  // Compute max for opacity scaling
  const maxCount = useMemo(() => {
    const vals = Object.values(countryDistribution);
    return vals.length > 0 ? Math.max(...vals) : 1;
  }, [countryDistribution]);

  return (
    <div className="relative w-full">
      <ComposableMap
        projectionConfig={{ rotate: [-10, 0, 0], scale: 147 }}
        width={800}
        height={400}
        style={{ width: '100%', height: 'auto' }}
      >
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const geoName = geo.properties.name as string;
                const data = geoLookup.get(geoName);

                if (!data) {
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#1e1e2e"
                      stroke="#2a2a3e"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none' },
                        hover: { outline: 'none', fill: '#2a2a3e' },
                        pressed: { outline: 'none' },
                      }}
                    />
                  );
                }

                const baseColor = REGION_COLORS[data.region] || '#94a3b8';
                // Scale opacity from 0.4 to 1.0 based on count
                const opacity = 0.4 + (data.count / maxCount) * 0.6;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={baseColor}
                    fillOpacity={opacity}
                    stroke="#0d0d1a"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: 'none' },
                      hover: {
                        outline: 'none',
                        fill: baseColor,
                        fillOpacity: 1,
                        stroke: '#fff',
                        strokeWidth: 1,
                      },
                      pressed: { outline: 'none' },
                    }}
                    data-tooltip-id="map-tooltip"
                    data-tooltip-content={`${data.country}: ${data.count} opps (${totalOpportunities > 0 ? ((data.count / totalOpportunities) * 100).toFixed(1) : 0}%)`}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Floating legend with counts */}
      <div className="absolute bottom-2 left-2 flex flex-wrap gap-x-4 gap-y-1 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
        {Object.entries(countryDistribution)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 8)
          .map(([country, count]) => {
            const region = COUNTRY_TO_REGION[country] || 'Other';
            const color = REGION_COLORS[region] || '#94a3b8';
            return (
              <div key={country} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] text-muted-foreground">
                  {country}
                </span>
                <span className="text-[10px] text-foreground font-medium">
                  {count}
                </span>
              </div>
            );
          })}
      </div>

      {/* Hover tooltip via native title — lightweight, no extra deps */}
    </div>
  );
}
