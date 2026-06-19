import { motion } from "framer-motion";

const categories = [
  { id: "todos", label: "Todos", emoji: "✨" },
  { id: "bebidas", label: "Bebidas", emoji: "🍺" },
  { id: "cocktails", label: "Cocktails", emoji: "🍹" },
  { id: "comida", label: "Comida", emoji: "🍔" },
  { id: "sobremesas", label: "Sobremesas", emoji: "🍮" },
  { id: "shisha", label: "Shisha", emoji: "💨" },
];

export default function CategoryTabs({ active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${
            active === cat.id
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
          }`}
        >
          <span>{cat.emoji}</span>
          <span>{cat.label}</span>
          {active === cat.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 rounded-full bg-primary -z-10"
            />
          )}
        </button>
      ))}
    </div>
  );
}