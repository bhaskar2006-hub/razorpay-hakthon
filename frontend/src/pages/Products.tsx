import { useEffect, useState } from "react";
import { api } from "../api";
import { Plus, Check } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  stock: number;
}

export default function Products({ customerId = "cmtepv2i300018wql42g5vvlc" }: { customerId?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await api.get("/products");
        setProducts(response.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  const handleAddToCart = async (productId: string) => {
    try {
      await api.post("/cart", { customerId, productId, quantity: 1 });
      setAddedIds((prev) => ({ ...prev, [productId]: true }));
      setTimeout(() => {
        setAddedIds((prev) => ({ ...prev, [productId]: false }));
      }, 1500);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <p style={{ color: "var(--text-secondary)" }}>Loading catalog from PostgreSQL...</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
          Product Catalog
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
          Authoritative PostgreSQL inventory with live pricing and stock limits.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
        {products.map((product) => (
          <div key={product.id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <span className="badge badge-accent">{product.category}</span>
                <span style={{ fontSize: "12px", color: product.stock > 0 ? "var(--success)" : "var(--danger)" }}>
                  {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                </span>
              </div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 6px 0", color: "var(--text-primary)" }}>
                {product.name}
              </h2>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                {product.description}
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
                ₹{(product.price / 100).toLocaleString("en-IN")}
              </div>
              <button
                className="btn btn-primary"
                onClick={() => handleAddToCart(product.id)}
                disabled={product.stock === 0}
                style={{ fontSize: "13px", padding: "6px 12px" }}
              >
                {addedIds[product.id] ? <Check size={16} /> : <Plus size={16} />}
                {addedIds[product.id] ? "Added!" : "Add to Cart"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
