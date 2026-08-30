import { useEffect, useState } from "react";
import { api } from "../api";
import { Plus, Check, Trash2, ShoppingBag } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  stock: number;
}

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
}

export default function Products({ customerId }: { customerId?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartItems, setCartItems] = useState<Record<string, number>>({});
  const [cartTotal, setCartTotal] = useState<number>(0);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});

  const fetchCart = async () => {
    if (!customerId) return;
    try {
      const res = await api.get(`/cart/${customerId}`);
      const map: Record<string, number> = {};
      if (res.data?.items) {
        res.data.items.forEach((item: CartItem) => {
          map[item.productId] = item.quantity;
        });
      }
      setCartItems(map);
      setCartTotal(res.data?.total || 0);
    } catch (err) {
      console.error("Cart fetch error:", err);
    }
  };

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
    fetchCart();
  }, [customerId]);

  const handleAddToCart = async (productId: string) => {
    try {
      await api.post("/cart", { customerId, productId, quantity: 1 });
      setAddedIds((prev) => ({ ...prev, [productId]: true }));
      await fetchCart();
      setTimeout(() => {
        setAddedIds((prev) => ({ ...prev, [productId]: false }));
      }, 1500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveFromCart = async (productId: string) => {
    try {
      await api.delete(`/cart/${customerId}/${productId}`);
      await fetchCart();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <p style={{ color: "var(--text-secondary)" }}>Loading catalog from PostgreSQL...</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            Product Catalog
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
            Authoritative PostgreSQL inventory with live pricing and stock limits.
          </p>
        </div>
        {Object.keys(cartItems).length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--bg-secondary)",
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border-accent)",
            }}
          >
            <ShoppingBag size={16} color="var(--accent-primary)" />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
              {Object.keys(cartItems).length} items in cart (₹{(cartTotal / 100).toLocaleString("en-IN")})
            </span>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
        {products.map((product) => {
          const inCartQty = cartItems[product.id] || 0;
          return (
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

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {inCartQty > 0 ? (
                    <>
                      <button
                        onClick={() => handleRemoveFromCart(product.id)}
                        style={{
                          background: "rgba(239, 68, 68, 0.1)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          color: "var(--danger)",
                          borderRadius: "6px",
                          padding: "6px 8px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                        title="Remove from cart"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleAddToCart(product.id)}
                        disabled={product.stock <= inCartQty}
                        style={{ fontSize: "12px", padding: "6px 10px" }}
                        title="Add another"
                      >
                        + ({inCartQty})
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleAddToCart(product.id)}
                      disabled={product.stock === 0}
                      style={{ fontSize: "13px", padding: "6px 12px" }}
                    >
                      {addedIds[product.id] ? <Check size={16} /> : <Plus size={16} />}
                      {addedIds[product.id] ? "Added!" : "Add to Cart"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
