// scripts/catalog.js
// -------------------------------------------------------------
// Catálogo de produtos extraídos das 3 cartas do B'Live Lounge Bar:
//   - PDF1: Carta principal (bebidas, cocktails, vinhos, etc.)
//   - PDF2: Carta de Shishas
//   - PDF3: Carta B'Live (comida)
//
// Imagens são placeholders da Unsplash (licença livre).
// -------------------------------------------------------------
export const PRODUCTS = [
  // ============== COCKTAILS (PDF1) ==============
  {
    name: "Caipirinha",
    description:
      "Cachaça Leblon, lima, xarope de açúcar branco. Variantes: morango, black, maracujá, manga.",
    price: 10,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&q=80",
  },
  {
    name: "Moscow Mule",
    description:
      "Vodka Eristoff, sumo de lima, xarope de açúcar, ginger beer, espuma de gengibre.",
    price: 13,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-1551751299-1b51cab2694c?w=400&q=80",
  },
  {
    name: "Mojito",
    description:
      "Bacardi, hortelã, sumo de lima, xarope de açúcar, água com gás. Variantes: maracujá, morango.",
    price: 10,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&q=80",
  },
  {
    name: "Negroni",
    description: "Bombay Sapphire, Martini Rosso, Campari.",
    price: 13,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1d?w=400&q=80",
  },
  {
    name: "Melon Sour",
    description:
      "Vodka Eristoff, licor de melão, sumo de limão, xarope de açúcar.",
    price: 11,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=80",
  },
  {
    name: "Blive Sour",
    description: "Drambuie, sumo de limão, xarope de açúcar.",
    price: 11,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Patron Margarita",
    description: "Patron Silver, Cointreau, sumo de limão.",
    price: 11,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&q=80",
  },
  {
    name: "Gin Basil Smash",
    description:
      "Gin Oxley, sumo de limão, xarope de manjericão, xarope de açúcar.",
    price: 15,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-1574116976434-100d2bd4fc7d?w=400&q=80",
  },
  {
    name: "Piña Colada",
    description: "Bacardi, sumo de ananás, batida de coco.",
    price: 10,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&q=80",
  },
  // ============== MOCKTAILS (PDF1) — 6€ cada ==============
  {
    name: "Red Berries Lemonade",
    description:
      "Frutos vermelhos, groselha, sumo de limão, xarope de açúcar, água tónica.",
    price: 6,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&q=80",
  },
  {
    name: "Strawberry Sour",
    description:
      "Polpa de morango, sumo de limão, xarope de açúcar, água com gás.",
    price: 6,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-1634185996243-c8c1c2e8e3e6?w=400&q=80",
  },
  {
    name: "Passion Sour",
    description:
      "Sumo de maracujá, sumo de limão, xarope de açúcar, xarope de baunilha.",
    price: 6,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-1599639957043-f3aa5c4d4c4c?w=400&q=80",
  },
  // ============== SANGRIAS (PDF1) — jarro 2 litros ==============
  {
    name: "Sangria de Maracujá",
    description: "Sangria de maracujá. Jarro de 2 litros.",
    price: 30,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Sangria de Frutos Vermelhos",
    description: "Sangria de frutos vermelhos. Jarro de 2 litros.",
    price: 30,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Sangria de Manga",
    description: "Sangria de manga. Jarro de 2 litros.",
    price: 30,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Sangria de Morango",
    description: "Sangria de morango. Jarro de 2 litros.",
    price: 30,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  // ============== VODKAS (PDF1) ==============
  {
    name: "Grey Goose",
    description: "Vodka premium francesa. Copo 13€ / Garrafa 130€.",
    price: 13,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Grey Goose Le Citron",
    description: "Vodka Grey Goose aroma limão. Copo 13€ / Garrafa 130€.",
    price: 13,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Grey Goose L'Orange",
    description: "Vodka Grey Goose aroma laranja. Copo 13€ / Garrafa 130€.",
    price: 13,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Grey Goose Le Poire",
    description: "Vodka Grey Goose aroma pera. Copo 15€ / Garrafa 150€.",
    price: 15,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Eristoff",
    description: "Vodka Eristoff. Copo 8€ / Garrafa 80€.",
    price: 8,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Eristoff Black",
    description: "Vodka Eristoff Black. Copo 7€ / Garrafa 70€.",
    price: 7,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Ciroc",
    description: "Vodka premium de uva. Copo 13€ / Garrafa 130€.",
    price: 13,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Belvedere",
    description: "Vodka premium polaca. Copo 13€ / Garrafa 130€.",
    price: 13,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Absolut",
    description: "Vodka sueca. Copo 9€ / Garrafa 90€.",
    price: 9,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  // ============== GINS (PDF1) ==============
  {
    name: "Bombay Sapphire",
    description:
      "Gin Bombay Sapphire. Copo 12€ / Garrafa 120€. Acompanhado de água tónica premium.",
    price: 12,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1614475281245-5b96b50c4c69?w=400&q=80",
  },
  {
    name: "Bombay Bramble",
    description: "Gin Bombay Bramble (frutos vermelhos). Copo 12€ / Garrafa 120€.",
    price: 12,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1614475281245-5b96b50c4c69?w=400&q=80",
  },
  {
    name: "Bombay Premier Cru",
    description: "Gin Bombay Premier Cru. Copo 14€ / Garrafa 140€.",
    price: 14,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1614475281245-5b96b50c4c69?w=400&q=80",
  },
  {
    name: "Bombay Presse",
    description: "Gin Bombay Presse. Copo 12€ / Garrafa 120€.",
    price: 12,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1614475281245-5b96b50c4c69?w=400&q=80",
  },
  {
    name: "Oxley",
    description: "Gin Oxley (destilação a frio). Copo 15€ / Garrafa 150€.",
    price: 15,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1614475281245-5b96b50c4c69?w=400&q=80",
  },
  {
    name: "Mare",
    description: "Gin Mare (Mediterrâneo). Copo 15€ / Garrafa 150€.",
    price: 15,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1614475281245-5b96b50c4c69?w=400&q=80",
  },
  {
    name: "Bulldog",
    description: "Gin Bulldog. Copo 13€ / Garrafa 130€.",
    price: 13,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1614475281245-5b96b50c4c69?w=400&q=80",
  },
  {
    name: "Hendricks",
    description: "Gin Hendrick's (pepino e rosas). Copo 15€ / Garrafa 150€.",
    price: 15,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1614475281245-5b96b50c4c69?w=400&q=80",
  },
  {
    name: "Nordes",
    description: "Gin Nordés (galego, Atlantic). Copo 14€ / Garrafa 140€.",
    price: 14,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1614475281245-5b96b50c4c69?w=400&q=80",
  },
  {
    name: "Monkey 47",
    description: "Gin Monkey 47 (47 botânicos). Copo 18€ / Garrafa 180€.",
    price: 18,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1614475281245-5b96b50c4c69?w=400&q=80",
  },
  {
    name: "Sharish",
    description: "Gin Sharish (Alentejo). Copo 15€ / Garrafa 150€.",
    price: 15,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1614475281245-5b96b50c4c69?w=400&q=80",
  },
  // ============== RUM (PDF1) ==============
  {
    name: "Bacardi 4",
    description: "Rum Bacardi 4 anos. Copo 8€ / Garrafa 80€.",
    price: 8,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Bacardi 8",
    description: "Rum Bacardi 8 anos. Copo 10€ / Garrafa 100€.",
    price: 10,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Bacardi Spiced",
    description: "Rum Bacardi Spiced. Copo 8€ / Garrafa 80€.",
    price: 8,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Bacardi Superior",
    description: "Rum Bacardi Superior (branco). Copo 8€ / Garrafa 80€.",
    price: 8,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Kraken",
    description: "Rum preto especiarias Kraken. Copo 11€ / Garrafa 110€.",
    price: 11,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Diplomatico Matuano",
    description: "Rum Diplomatico Matuano (Venezuela). Copo 14€ / Garrafa 140€.",
    price: 14,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Santa Tereza Gran Reserva",
    description: "Rum Santa Teresa Gran Reserva. Copo 9€ / Garrafa 90€.",
    price: 9,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Santa Tereza 1796",
    description: "Rum premium Santa Teresa 1796. Copo 15€ / Garrafa 150€.",
    price: 15,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  // ============== BRANDY / COGNAC (PDF1) ==============
  {
    name: "Brandy Macieira",
    description: "Brandy Macieira. Copo 5€ / Garrafa 60€.",
    price: 5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Hennessy",
    description: "Cognac Hennessy. Copo 15€ / Garrafa 150€.",
    price: 15,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Courvoisier",
    description: "Cognac Courvoisier. Copo 13€ / Garrafa 130€.",
    price: 13,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  // ============== WHISKY (PDF1) ==============
  {
    name: "Dewar's Caribbean",
    description: "Whisky Dewar's Caribbean. Copo 8€ / Garrafa 80€.",
    price: 8,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Famous Grouse",
    description: "Whisky Famous Grouse. Copo 8,50€ / Garrafa 85€.",
    price: 8.5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Jameson",
    description: "Whisky irlandês Jameson. Copo 9€ / Garrafa 90€.",
    price: 9,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Red Label",
    description: "Whisky Johnnie Walker Red Label. Copo 8,50€ / Garrafa 85€.",
    price: 8.5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Jack Daniel's",
    description: "Whisky Jack Daniel's. Copo 10€ / Garrafa 100€.",
    price: 10,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Jack Daniel's Apple",
    description: "Whisky Jack Daniel's Apple. Copo 10€ / Garrafa 100€.",
    price: 10,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Jack Daniel's Honey",
    description: "Whisky Jack Daniel's Honey. Copo 10€ / Garrafa 100€.",
    price: 10,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Whisky Velho Dewar's 12A",
    description: "Whisky Dewar's 12 anos. Copo 10€ / Garrafa 100€.",
    price: 10,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Black Label",
    description: "Johnnie Walker Black Label 12 anos. Copo 11€ / Garrafa 110€.",
    price: 11,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Macallan Double Cask 12A",
    description: "Macallan Double Cask 12 anos. Copo 20€ / Garrafa 200€.",
    price: 20,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Nikka From The Barrel",
    description:
      "Whisky japonês Nikka From The Barrel. Copo 15€ / Garrafa 150€.",
    price: 15,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Aberfeldy",
    description: "Whisky Aberfeldy. Copo 15€ / Garrafa 150€.",
    price: 15,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Cardhu",
    description: "Whisky Cardhu. Copo 13€ / Garrafa 130€.",
    price: 13,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Blue Label",
    description:
      "Johnnie Walker Blue Label (premium). Copo 30€ / Garrafa 300€.",
    price: 30,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  // ============== CHAMPANHE (PDF1) ==============
  {
    name: "Moet & Chandon Brut Imperial 0,75L",
    description: "Champanhe Moët & Chandon Brut Impérial, garrafa 0,75L.",
    price: 120,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=400&q=80",
  },
  {
    name: "Moet & Chandon Ice Imperial 0,75L",
    description: "Champanhe Moët & Chandon Ice Impérial, garrafa 0,75L.",
    price: 140,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=400&q=80",
  },
  {
    name: "Moet & Chandon Nectar Imperial 0,75L",
    description:
      "Champanhe Moët & Chandon Nectar Impérial (meio-doce), 0,75L.",
    price: 130,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=400&q=80",
  },
  {
    name: "Veuve Clicquot Rich 0,75L",
    description: "Champanhe Veuve Clicquot Rich, garrafa 0,75L.",
    price: 130,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=400&q=80",
  },
  {
    name: "Veuve Clicquot Brut",
    description: "Champanhe Veuve Clicquot Brut.",
    price: 120,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=400&q=80",
  },
  // ============== ESPUMANTES (PDF1) ==============
  {
    name: "Espumante Raposeira Reserva Doce 0,75L",
    description: "Espumante Raposeira Reserva Doce, garrafa 0,75L.",
    price: 50,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=400&q=80",
  },
  {
    name: "Espumante Raposeira Reserva Bruto 0,75L",
    description: "Espumante Raposeira Reserva Bruto, garrafa 0,75L.",
    price: 45,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=400&q=80",
  },
  // ============== CACHAÇA (PDF1) ==============
  {
    name: "Leblon",
    description: "Cachaça artesanal Leblon. Copo 12€.",
    price: 12,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Velho Barreiro",
    description: "Cachaça Velho Barreiro. Copo 9€.",
    price: 9,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  // ============== LICORES (PDF1) ==============
  {
    name: "St. Germain",
    description:
      "Licor de flores de sabugueiro St. Germain. Copo 10€ / Garrafa 100€.",
    price: 10,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Baileys",
    description: "Licor Baileys Irish Cream. Copo 7€ / Garrafa 70€.",
    price: 7,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Safari",
    description: "Licor Safari (frutos tropicais). Copo 7€ / Garrafa 70€.",
    price: 7,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Licor Beirão",
    description: "Licor Beirão. Copo 7€ / Garrafa 70€.",
    price: 7,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Beirão d'Honra",
    description: "Beirão d'Honra (edição premium). Copo 9€ / Garrafa 90€.",
    price: 9,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Amêndoa Amarga",
    description: "Licor de Amêndoa Amarga. Copo 5€ / Garrafa 60€.",
    price: 5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Drambuie",
    description: "Whisky licoroso Drambuie. Copo 9€ / Garrafa 90€.",
    price: 9,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Malibu",
    description: "Licor Malibu (coco). Copo 7€ / Garrafa 70€.",
    price: 7,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Macieira Cream",
    description: "Licor Macieira Cream. Copo 7€ / Garrafa 70€.",
    price: 7,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Disaronno",
    description: "Licor Disaronno (amaretto). Copo 9€ / Garrafa 90€.",
    price: 9,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  // ============== SHOTS (PDF1) ==============
  {
    name: "Patron Silver (shot)",
    description: "Tequila Patron Silver, shot.",
    price: 5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Patron Reposado (shot)",
    description: "Tequila Patron Reposado, shot.",
    price: 5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Patron Añejo (shot)",
    description: "Tequila Patron Añejo, shot.",
    price: 5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Serviço (shot)",
    description: "Shot de serviço da casa.",
    price: 4,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Premium (shot)",
    description: "Shot premium.",
    price: 5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  // ============== REFRIGERANTES (PDF1) ==============
  {
    name: "Ginger Beer",
    description: "Ginger Beer, lata.",
    price: 3,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1624552184280-9e9631bbeee9?w=400&q=80",
  },
  {
    name: "Água 0,33L",
    description: "Água mineral, garrafa 0,33L.",
    price: 2.5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1560847468-5eef0e58881c?w=400&q=80",
  },
  {
    name: "Pedras",
    description: "Água das Pedras, garrafa.",
    price: 3,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1560847468-5eef0e58881c?w=400&q=80",
  },
  {
    name: "Pedras Sabores",
    description: "Pedras Sabores: limão, maracujá ou frutos vermelhos.",
    price: 3,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1560847468-5eef0e58881c?w=400&q=80",
  },
  {
    name: "Sumo de Laranja Natural",
    description: "Sumo de laranja natural espremido no momento.",
    price: 4,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400&q=80",
  },
  {
    name: "Limonada",
    description: "Limonada fresca da casa.",
    price: 4,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1523677011781-c91d1bbe1b8f?w=400&q=80",
  },
  {
    name: "Coca-Cola",
    description: "Coca-Cola lata.",
    price: 3,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80",
  },
  {
    name: "Coca-Cola Zero",
    description: "Coca-Cola Zero lata.",
    price: 3,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80",
  },
  {
    name: "Fuze Tea",
    description: "Fuze Tea: manga-ananás, limão ou pêssego.",
    price: 3,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&q=80",
  },
  {
    name: "Tónica",
    description: "Água tónica, lata.",
    price: 3,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1624552184280-9e9631bbeee9?w=400&q=80",
  },
  {
    name: "Ginger Ale",
    description: "Ginger Ale, lata.",
    price: 3,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&q=80",
  },
  {
    name: "Red Bull",
    description: "Red Bull energy drink, lata.",
    price: 4,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80",
  },
  // ============== CERVEJAS / CIDRA (PDF1) ==============
  {
    name: "Heineken 0,25L",
    description: "Cerveja Heineken, caneca 0,25L.",
    price: 3,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&q=80",
  },
  {
    name: "Heineken 0,50L",
    description: "Cerveja Heineken, caneca 0,50L.",
    price: 4.5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&q=80",
  },
  {
    name: "Desperados",
    description: "Cerveja Desperados (tequila).",
    price: 5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&q=80",
  },
  {
    name: "Bandida do Pomar",
    description: "Cidra Bandida do Pomar.",
    price: 3.5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&q=80",
  },
  {
    name: "Bandida do Pomar FV",
    description: "Cidra Bandida do Pomar Frutos Vermelhos.",
    price: 3.5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&q=80",
  },
  // ============== CAFETARIA (PDF1) ==============
  {
    name: "Café",
    description: "Café espresso.",
    price: 1.5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80",
  },
  {
    name: "Descafeinado",
    description: "Café descafeinado.",
    price: 1.5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80",
  },
  {
    name: "Chás",
    description: "Seleção de chás.",
    price: 2.5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=400&q=80",
  },
  // ============== APERITIVOS (PDF1) ==============
  {
    name: "Martini (Rubino/Ambrato/Bitter)",
    description: "Martini Rubino, Ambrato ou Bitter.",
    price: 6,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Martini (Bianco/Rosso/Fiero)",
    description: "Martini Bianco, Rosso ou Fiero.",
    price: 5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-15682195574005-5b7c2e2e0c1b?w=400&q=80",
  },
  {
    name: "Vinho (Branco/Tinto) copo",
    description: "Vinho branco ou tinto, copo.",
    price: 6,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&q=80",
  },
  {
    name: "Vinho do Porto",
    description: "Vinho do Porto, copo.",
    price: 8,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=400&q=80",
  },
  {
    name: "Moscatel",
    description: "Moscatel, copo.",
    price: 5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=400&q=80",
  },
  {
    name: "Moscatel Roxo",
    description: "Moscatel Roxo, copo.",
    price: 7,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=400&q=80",
  },
  // ============== VINHOS (PDF1) ==============
  {
    name: "Papa Figos GR (Tinto/Branco)",
    description: "Vinho Papa Figos, garrafa (tinto ou branco).",
    price: 18,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&q=80",
  },
  {
    name: "Papa Figos Rosé GR",
    description: "Vinho Papa Figos Rosé, garrafa.",
    price: 18,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=400&q=80",
  },
  {
    name: "Lambrusco D. Emilia",
    description: "Vinho Lambrusco Dell'Emilia, garrafa.",
    price: 17.5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&q=80",
  },
  // ============== SHISHAS (PDF2) ==============
  {
    name: "Shisha Standard — Kizz (Menta)",
    description:
      "Shisha Standard (18€) — sabor Kizz: menta. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — A Way (Manga, Ananás e Menta)",
    description:
      "Shisha Standard (18€) — sabor A Way: manga, ananás e menta. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — Dragan Code (Cola e RedBull)",
    description:
      "Shisha Standard (18€) — sabor Dragan Code: cola e RedBull. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — Blue I'ss (Blueberry e Gelo)",
    description:
      "Shisha Standard (18€) — sabor Blue I'ss: blueberry e gelo. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — Love 66 (Frutos Tropicais e Menta)",
    description:
      "Shisha Standard (18€) — sabor Love 66: frutos tropicais e menta. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — Mi Amor (Abacaxi, Banana e Menta)",
    description:
      "Shisha Standard (18€) — sabor Mi Amor: abacaxi, banana e menta. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — Berlim (Pêssego e Menta)",
    description:
      "Shisha Standard (18€) — sabor Berlim: pêssego e menta. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — Banas (Banana)",
    description:
      "Shisha Standard (18€) — sabor Banas: banana. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — I,ss Boni (Menta Doce e Pastilha)",
    description:
      "Shisha Standard (18€) — sabor I,ss Boni: menta doce e pastilha. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — Swiss Boom (Bombom Suíço)",
    description:
      "Shisha Standard (18€) — sabor Swiss Boom: bombom suíço. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — Baku Nights (Tutti Fruti e Menta)",
    description:
      "Shisha Standard (18€) — sabor Baku Nights: tutti fruti e menta. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — Moscow Evenings (Melancia, Maracujá e Menta)",
    description:
      "Shisha Standard (18€) — sabor Moscow Evenings: melancia, maracujá e menta. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — Iss Lie on the Rocks (Pastilha, Mirtilo, Gelo e Menta)",
    description:
      "Shisha Standard (18€) — sabor Iss Lie on the Rocks: pastilha mirtilo, gelo e menta. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — No Woman No Cry (Morango, Pera, Hortelã e Menta)",
    description:
      "Shisha Standard (18€) — sabor No Woman No Cry: morango, pera, hortelã e menta. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — Rio Kizz (Maracujá e Menta)",
    description:
      "Shisha Standard (18€) — sabor Rio Kizz: maracujá e menta. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — Two Yellow (Melão e Melancia)",
    description:
      "Shisha Standard (18€) — sabor Two Yellow: melão e melancia. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — Rhapsody (Pêssego, Ananás e Menta)",
    description:
      "Shisha Standard (18€) — sabor Rhapsody: pêssego, ananás e menta. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard — L. Kill (Pêssego, Manga, Hortelã e Menta)",
    description:
      "Shisha Standard (18€) — sabor L. Kill: pêssego, manga, hortelã e menta. Máximo 4 pessoas por shisha.",
    price: 18,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha Standard com Bazuka",
    description:
      "Shisha Standard com Bazuka (23€) — escolhe o sabor no bar. Máximo 4 pessoas por shisha.",
    price: 23,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  {
    name: "Shisha B'Live Quasar",
    description:
      "Shisha B'Live Quasar (25€) — edição premium da casa. Máximo 4 pessoas por shisha.",
    price: 25,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
  },
  // ============== COMIDA — OS CLÁSSICOS (PDF3) ==============
  {
    name: "O Burger B'Live",
    description: "Picanha, queijo cheddar, bacon, tomate.",
    price: 14,
    category: "comida",
    image_url:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80",
  },
  {
    name: "O Burger B'Live Extra",
    description:
      "Carne de vaca, bacon, cheddar, ovo, cebola caramelizada, tomate, alface.",
    price: 16,
    category: "comida",
    image_url:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80",
  },
  {
    name: "Gambas à Lá Chef",
    description: "Camarão sem cabeça ao alho e molho à lá chef.",
    price: 13,
    category: "comida",
    image_url:
      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&q=80",
  },
  // ============== COMIDA — AS TOSTAS (PDF3) ==============
  {
    name: "Tosta Mista",
    description: "Queijo flamengo, fiambre.",
    price: 7,
    category: "comida",
    image_url:
      "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80",
  },
  {
    name: "Tosta de Frango",
    description: "Cubos de frango, maionese.",
    price: 9,
    category: "comida",
    image_url:
      "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80",
  },
  {
    name: "Tosta de Atum",
    description: "Pasta de atum e maionese.",
    price: 9,
    category: "comida",
    image_url:
      "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80",
  },
  // ============== COMIDA — OS FRITOS (PDF3) ==============
  {
    name: "Alexandria à Lá Chef",
    description: "Batata palitos frita com queijo cheddar e bacon.",
    price: 5,
    category: "comida",
    image_url:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80",
  },
  {
    name: "Batatas King B'Live",
    description:
      "Batata palitos frita com queijo cheddar, bacon, cebola caramelizada.",
    price: 5.5,
    category: "comida",
    image_url:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80",
  },
  {
    name: "Batata Frita",
    description: "Batata frita doce ou normal.",
    price: 3.5,
    category: "comida",
    image_url:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80",
  },
  {
    name: "Asinhas de Frango",
    description: "Asas de frango fritas, molho de barbecue.",
    price: 9,
    category: "comida",
    image_url:
      "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=400&q=80",
  },
  {
    name: "Aros de Lula",
    description: "Cebola saborosa — 8 unidades.",
    price: 5,
    category: "comida",
    image_url:
      "https://images.unsplash.com/photo-1625937329935-287441889dab?w=400&q=80",
  },
  {
    name: "Sticks Mozzarella",
    description: "Sticks de mozzarella empanados, fritos.",
    price: 7,
    category: "comida",
    image_url:
      "https://images.unsplash.com/photo-1625937329935-287441889dab?w=400&q=80",
  },
  // ============== COMIDA — OS DOCES (PDF3) ==============
  {
    name: "Nutella",
    description: "Creme de chocolate Nutella.",
    price: 6,
    category: "sobremesas",
    image_url:
      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&q=80",
  },
  {
    name: "Nutella & Fruta",
    description: "Nutella com fruta fresca da época.",
    price: 7.5,
    category: "sobremesas",
    image_url:
      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&q=80",
  },
  {
    name: "Nutella & Gelado",
    description: "Nutella com gelado.",
    price: 7.5,
    category: "sobremesas",
    image_url:
      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&q=80",
  },
  {
    name: "Nutella & Fruta & Gelado",
    description: "Nutella com fruta e gelado.",
    price: 9,
    category: "sobremesas",
    image_url:
      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&q=80",
  },
];

console.log(`[catalog] Total de produtos no catálogo: ${PRODUCTS.length}`);
