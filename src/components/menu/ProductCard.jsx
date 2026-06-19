import { Plus, Minus } from "lucide-react";
import { motion } from "framer-motion";

export default function ProductCard({ product, quantity, onAdd, onRemove }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl overflow-hidden border border-border/50 flex flex-col"
    >
      {product.image_url && (
        <div className="h-36 overflow-hidden">
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex-1">
          <h3 className="font-playfair font-semibold text-foreground text-base leading-tight">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-muted-foreground text-xs mt-1 line-clamp-2">
              {product.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-primary font-semibold text-lg">
            €{product.price.toFixed(2)}
          </span>
          {quantity > 0 ? (
            <div className="flex items-center gap-2 bg-secondary rounded-full px-2 py-1">
              <button
                onClick={onRemove}
                className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/40 transition-colors"
              >
                <Minus className="w-3 h-3 text-primary" />
              </button>
              <span className="text-foreground font-semibold text-sm w-4 text-center">
                {quantity}
              </span>
              <button
                onClick={onAdd}
                className="w-6 h-6 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors"
              >
                <Plus className="w-3 h-3 text-primary-foreground" />
              </button>
            </div>
          ) : (
            <button
              onClick={onAdd}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors shadow-md shadow-primary/30"
            >
              <Plus className="w-4 h-4 text-primary-foreground" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}