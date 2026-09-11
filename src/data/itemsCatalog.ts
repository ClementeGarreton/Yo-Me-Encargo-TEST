export interface CatalogItem {
  id: string
  name: string
  category: string
  volume: number // m³
  weight: number // kg
  isFragile: boolean
  isHeavy: boolean
  isGlass: boolean
  image: string
}

export const itemsCatalog: CatalogItem[] = [
  // Muebles de Sala
  { id: 'sofa-3', name: 'Sofá 3 cuerpos', category: 'Sala', volume: 2.5, weight: 80, isFragile: false, isHeavy: true, isGlass: false, image: '🛋️' },
  { id: 'sofa-2', name: 'Sofá 2 cuerpos', category: 'Sala', volume: 2.0, weight: 60, isFragile: false, isHeavy: true, isGlass: false, image: '🛋️' },
  { id: 'sillon', name: 'Sillón', category: 'Sala', volume: 1.2, weight: 35, isFragile: false, isHeavy: false, isGlass: false, image: '🪑' },
  { id: 'mesa-centro', name: 'Mesa de Centro', category: 'Sala', volume: 0.5, weight: 25, isFragile: false, isHeavy: false, isGlass: true, image: '🪑' },
  { id: 'estante', name: 'Estante/Biblioteca', category: 'Sala', volume: 1.8, weight: 50, isFragile: false, isHeavy: true, isGlass: false, image: '📚' },
  { id: 'tv-grande', name: 'TV Grande (>50")', category: 'Sala', volume: 0.3, weight: 15, isFragile: true, isHeavy: false, isGlass: true, image: '📺' },
  { id: 'tv-mediano', name: 'TV Mediano (32-50")', category: 'Sala', volume: 0.2, weight: 10, isFragile: true, isHeavy: false, isGlass: true, image: '📺' },

  // Muebles de Comedor
  { id: 'mesa-comedor-6', name: 'Mesa Comedor 6 personas', category: 'Comedor', volume: 1.5, weight: 60, isFragile: false, isHeavy: true, isGlass: false, image: '🍽️' },
  { id: 'mesa-comedor-4', name: 'Mesa Comedor 4 personas', category: 'Comedor', volume: 1.0, weight: 40, isFragile: false, isHeavy: false, isGlass: false, image: '🍽️' },
  { id: 'silla-comedor', name: 'Silla de Comedor', category: 'Comedor', volume: 0.3, weight: 8, isFragile: false, isHeavy: false, isGlass: false, image: '🪑' },
  { id: 'vitrina', name: 'Vitrina/Vajillero', category: 'Comedor', volume: 1.2, weight: 50, isFragile: true, isHeavy: true, isGlass: true, image: '🗄️' },

  // Muebles de Dormitorio
  { id: 'cama-2-plazas', name: 'Cama 2 Plazas', category: 'Dormitorio', volume: 2.0, weight: 70, isFragile: false, isHeavy: true, isGlass: false, image: '🛏️' },
  { id: 'cama-1.5-plazas', name: 'Cama 1.5 Plazas', category: 'Dormitorio', volume: 1.5, weight: 50, isFragile: false, isHeavy: true, isGlass: false, image: '🛏️' },
  { id: 'cama-1-plaza', name: 'Cama 1 Plaza', category: 'Dormitorio', volume: 1.2, weight: 35, isFragile: false, isHeavy: false, isGlass: false, image: '🛏️' },
  { id: 'colchon-2-plazas', name: 'Colchón 2 Plazas', category: 'Dormitorio', volume: 1.5, weight: 30, isFragile: false, isHeavy: false, isGlass: false, image: '🛏️' },
  { id: 'colchon-1-plaza', name: 'Colchón 1 Plaza', category: 'Dormitorio', volume: 0.8, weight: 20, isFragile: false, isHeavy: false, isGlass: false, image: '🛏️' },
  { id: 'velador', name: 'Velador/Mesa de Noche', category: 'Dormitorio', volume: 0.3, weight: 15, isFragile: false, isHeavy: false, isGlass: false, image: '🪑' },
  { id: 'comoda', name: 'Cómoda', category: 'Dormitorio', volume: 1.0, weight: 40, isFragile: false, isHeavy: false, isGlass: false, image: '🗄️' },
  { id: 'ropero-grande', name: 'Ropero Grande (3 cuerpos)', category: 'Dormitorio', volume: 3.5, weight: 100, isFragile: false, isHeavy: true, isGlass: false, image: '🚪' },
  { id: 'ropero-mediano', name: 'Ropero Mediano (2 cuerpos)', category: 'Dormitorio', volume: 2.5, weight: 70, isFragile: false, isHeavy: true, isGlass: false, image: '🚪' },

  // Electrodomésticos
  { id: 'refrigerador', name: 'Refrigerador', category: 'Electrodomésticos', volume: 2.0, weight: 80, isFragile: true, isHeavy: true, isGlass: false, image: '🧊' },
  { id: 'lavadora', name: 'Lavadora', category: 'Electrodomésticos', volume: 1.2, weight: 70, isFragile: true, isHeavy: true, isGlass: false, image: '🧺' },
  { id: 'secadora', name: 'Secadora', category: 'Electrodomésticos', volume: 1.2, weight: 60, isFragile: true, isHeavy: true, isGlass: false, image: '🧺' },
  { id: 'microondas', name: 'Microondas', category: 'Electrodomésticos', volume: 0.2, weight: 15, isFragile: true, isHeavy: false, isGlass: true, image: '📻' },
  { id: 'horno-electrico', name: 'Horno Eléctrico', category: 'Electrodomésticos', volume: 0.3, weight: 20, isFragile: true, isHeavy: false, isGlass: true, image: '🔥' },

  // Oficina
  { id: 'escritorio', name: 'Escritorio', category: 'Oficina', volume: 1.2, weight: 40, isFragile: false, isHeavy: false, isGlass: false, image: '🖥️' },
  { id: 'silla-oficina', name: 'Silla de Oficina', category: 'Oficina', volume: 0.5, weight: 15, isFragile: false, isHeavy: false, isGlass: false, image: '🪑' },
  { id: 'archivador', name: 'Archivador', category: 'Oficina', volume: 0.8, weight: 30, isFragile: false, isHeavy: false, isGlass: false, image: '🗄️' },

  // Otros
  { id: 'caja-libros', name: 'Caja de Libros', category: 'Otros', volume: 0.1, weight: 20, isFragile: false, isHeavy: true, isGlass: false, image: '📦' },
  { id: 'caja-mediana', name: 'Caja Mediana', category: 'Otros', volume: 0.1, weight: 10, isFragile: false, isHeavy: false, isGlass: false, image: '📦' },
  { id: 'caja-ropa', name: 'Caja de Ropa', category: 'Otros', volume: 0.2, weight: 15, isFragile: false, isHeavy: false, isGlass: false, image: '📦' },
  { id: 'bicicleta', name: 'Bicicleta', category: 'Otros', volume: 0.5, weight: 15, isFragile: false, isHeavy: false, isGlass: false, image: '🚲' },
]

export const categories = [
  'Todos',
  'Sala',
  'Comedor',
  'Dormitorio',
  'Electrodomésticos',
  'Oficina',
  'Otros',
]

