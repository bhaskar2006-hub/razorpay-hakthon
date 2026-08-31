import { useState, useEffect, useRef } from "react";
import { api } from "../api";
import { openRazorpayCheckout } from "../lib/razorpay";
import {
  Send,
  Sparkles,
  Bot,
  User,
  ShoppingBag,
  Check,
  Plus,
  ShieldAlert,
  CreditCard,
  X,
  XCircle,
  AlertCircle,
  CheckCircle2,
  RefreshCcw,
  RefreshCw,
  Trash2,
  Copy,
  QrCode,
  Mic,
  MicOff,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: any[];
  recommendations?: any[];
  toolCalls?: any[];
}

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    description: string;
  };
}

export default function AISales({ customerId = "cmtepv2i300018wql42g5vvlc" }: { customerId?: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I am RazorAI, your sales and commerce assistant. Tell me what product you're looking for, or pick a recommendation below!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<{ items: CartItem[]; total: number; formattedTotal: string }>({
    items: [],
    total: 0,
    formattedTotal: "₹0",
  });

  // Approval / Checkout Modal State
  const [preview, setPreview] = useState<any>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [orderResult, setOrderResult] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<"IDLE" | "SUCCESS" | "FAILED">("IDLE");
  const [failureReason, setFailureReason] = useState<string>("");

  // Advanced Checkout States
  const [modalTab, setModalTab] = useState<"checkout" | "affordability" | "share">("checkout");
  const [affordabilityData, setAffordabilityData] = useState<any>(null);
  const [loadingAffordability, setLoadingAffordability] = useState(false);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState("");
  const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedBankIdx, setSelectedBankIdx] = useState(0);

  // Voice Speech-to-Text State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-IN";

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0])
            .map((result: any) => result.transcript)
            .join("");
          setInput(transcript);
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (e) {
        console.warn("Speech init failed:", e);
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.warn("Speech start error:", e);
      }
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchCart = async () => {
    try {
      const res = await api.get(`/cart/${customerId}`);
      setCart({
        items: res.data.items || [],
        total: res.data.total || 0,
        formattedTotal: res.data.formattedTotal || `₹${((res.data.total || 0) / 100).toLocaleString("en-IN")}`,
      });
    } catch (err) {
      console.error("Fetch cart error:", err);
    }
  };

  useEffect(() => {
    fetchCart();
  }, [customerId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.post("/agent/chat", {
        message: text,
        customerId,
        history,
      });

      const assistantMsg: Message = {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: res.data.message,
        products: res.data.products,
        recommendations: res.data.recommendations,
        toolCalls: res.data.toolCalls,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      await fetchCart();

      // If user confirmed checkout intent in conversation, open approval preview immediately
      if (res.data.triggerCheckout) {
        setTimeout(() => {
          handleOpenCheckoutPreview();
        }, 500);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: "Sorry, I encountered an issue processing that. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (productId: string) => {
    try {
      await api.post("/cart", {
        customerId,
        productId,
        quantity: 1,
      });
      await fetchCart();
    } catch (err) {
      console.error("Add to cart error:", err);
    }
  };

  const handleDirectBuyNow = async (productId: string) => {
    await handleAddToCart(productId);
    handleOpenCheckoutPreview();
  };

  const handleRemoveFromCart = async (productId: string) => {
    try {
      await api.delete(`/cart/${customerId}/${productId}`);
      await fetchCart();
    } catch (err) {
      console.error("Remove from cart error:", err);
    }
  };

  const handleClearCart = async () => {
    try {
      await api.delete(`/cart/${customerId}`);
      await fetchCart();
    } catch (err) {
      console.error("Clear cart error:", err);
    }
  };

  const fetchAffordability = async (amount: number) => {
    try {
      setLoadingAffordability(true);
      const res = await api.get(`/checkout/affordability?amount=${amount}`);
      setAffordabilityData(res.data);
    } catch (err) {
      console.error("Failed to fetch affordability:", err);
    } finally {
      setLoadingAffordability(false);
    }
  };

  const handleOpenCheckoutPreview = async () => {
    try {
      const res = await api.post("/checkout/preview", { customerId });
      setPreview(res.data);
      setShowApprovalModal(true);
      setOrderResult(null);
      setPaymentStatus("IDLE");
      setModalTab("checkout");
      setPaymentLinkUrl("");
      fetchAffordability(res.data.total);
    } catch (err: any) {
      alert(err.response?.data?.message || "Unable to generate checkout preview. Ensure cart is not empty.");
    }
  };

  const handleCreatePaymentLink = async () => {
    if (creatingPaymentLink) return;
    setCreatingPaymentLink(true);
    setPaymentLinkUrl("");
    try {
      let targetOrderId = orderResult?.orderId;
      if (!targetOrderId) {
        const approveRes = await api.post("/checkout/approve", {
          customerId,
          userApproved: true,
          expectedTotal: preview?.total,
        });
        setOrderResult(approveRes.data);
        targetOrderId = approveRes.data.orderId;
      }

      const linkRes = await api.post("/checkout/payment-link", {
        orderId: targetOrderId,
      });
      setPaymentLinkUrl(linkRes.data.shortUrl || `https://rzp.io/l/razorai-${targetOrderId.slice(-8)}`);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create payment link");
    } finally {
      setCreatingPaymentLink(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentLinkUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleApprovePayment = async () => {
    setProcessingPayment(true);
    try {
      const res = await api.post("/checkout/approve", {
        customerId,
        userApproved: true,
        expectedTotal: preview?.total,
      });

      setOrderResult(res.data);

      await openRazorpayCheckout({
        orderId: res.data.orderId,
        razorpayOrderId: res.data.razorpayOrderId,
        amount: res.data.amount,
        currency: res.data.currency || "INR",
        description: `RazorAI Order: ₹${((res.data.amount || 0) / 100).toLocaleString("en-IN")}`,
        onSuccess: async (response) => {
          try {
            await api.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setPaymentStatus("SUCCESS");
            await fetchCart();
          } catch (verifyErr: any) {
            setPaymentStatus("FAILED");
            setFailureReason(verifyErr.response?.data?.message || "Payment signature verification failed");
          } finally {
            setProcessingPayment(false);
          }
        },
        onFailure: async (error: any) => {
          try {
            const failRes = await api.post("/payments/fail", {
              orderId: res.data.orderId,
              razorpay_order_id: error?.metadata?.order_id || res.data.razorpayOrderId,
              razorpay_payment_id: error?.metadata?.payment_id,
              reason: error?.description || "Payment failed or cancelled",
            });
            setFailureReason(failRes.data?.explanation || error?.description || "Payment failed");
          } catch (e) {
            setFailureReason(error?.description || "Payment failed");
          } finally {
            setPaymentStatus("FAILED");
            setProcessingPayment(false);
          }
        },
        onDismiss: () => {
          setProcessingPayment(false);
        },
      });
    } catch (err: any) {
      console.error("Approval error:", err);
      setPaymentStatus("FAILED");
      setFailureReason(err.response?.data?.message || "Payment approval failed by Policy Engine");
      setProcessingPayment(false);
    }
  };

  const handleSimulateFailure = async () => {
    setProcessingPayment(true);
    try {
      const res = await api.post("/checkout/approve", {
        customerId,
        userApproved: true,
        expectedTotal: preview?.total,
      });

      setOrderResult(res.data);

      // Simulate failure endpoint
      const failRes = await api.post("/payments/fail", {
        orderId: res.data.orderId,
        reason: "Card issuer declined transaction (Insufficient Funds / OTP Timeout)",
      });

      setPaymentStatus("FAILED");
      setFailureReason(failRes.data.explanation || "Payment failed");
    } catch (err: any) {
      setPaymentStatus("FAILED");
      setFailureReason(err.response?.data?.message || "Payment failure simulated");
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!orderResult?.orderId) return;
    setProcessingPayment(true);
    try {
      const res = await api.post(`/orders/${orderResult.orderId}/retry`);
      setOrderResult(res.data);

      await openRazorpayCheckout({
        orderId: res.data.orderId,
        razorpayOrderId: res.data.razorpayOrderId,
        amount: res.data.amount,
        currency: res.data.currency || "INR",
        description: `Retry Payment: ₹${((res.data.amount || 0) / 100).toLocaleString("en-IN")}`,
        onSuccess: async (response) => {
          try {
            await api.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setPaymentStatus("SUCCESS");
            await fetchCart();
          } catch (verifyErr: any) {
            setPaymentStatus("FAILED");
            setFailureReason(verifyErr.response?.data?.message || "Payment signature verification failed");
          } finally {
            setProcessingPayment(false);
          }
        },
        onFailure: async (error: any) => {
          try {
            const failRes = await api.post("/payments/fail", {
              orderId: res.data.orderId,
              razorpay_order_id: error?.metadata?.order_id || res.data.razorpayOrderId,
              razorpay_payment_id: error?.metadata?.payment_id,
              reason: error?.description || "Payment retry failed",
            });
            setFailureReason(failRes.data?.explanation || error?.description || "Payment failed");
          } catch (e) {
            setFailureReason(error?.description || "Payment failed");
          } finally {
            setPaymentStatus("FAILED");
            setProcessingPayment(false);
          }
        },
        onDismiss: () => {
          setProcessingPayment(false);
        },
      });
    } catch (err: any) {
      setPaymentStatus("FAILED");
      setFailureReason(err.response?.data?.message || "Retry failed");
      setProcessingPayment(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px", height: "calc(100vh - 120px)" }}>
      {/* Chat Area */}
      <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: 0, overflow: "hidden" }}>
        {/* Chat Header */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "var(--accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={18} color="white" />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>RazorAI Sales Agent</div>
              <div style={{ fontSize: "11px", color: "var(--success)", display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--success)" }} />
                PostgreSQL Catalog + Gemini 2.5 Flash
              </div>
            </div>
          </div>
          <span className="badge badge-accent">Bounded & Gated</span>
        </div>

        {/* Messages List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                gap: "12px",
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
              }}
            >
              {m.role === "assistant" && (
                <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "var(--bg-accent)", border: "1px solid var(--border-accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Bot size={16} color="#818cf8" />
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: "12px",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    background: m.role === "user" ? "var(--accent-primary)" : "var(--bg-secondary)",
                    color: "white",
                    border: m.role === "user" ? "none" : "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {m.content.split("\n").map((line, lIdx) => {
                      if (!line.trim()) return <div key={lIdx} style={{ height: "4px" }} />;
                      const parts = line.split(/(\*\*.*?\*\*)/g);
                      return (
                        <div key={lIdx}>
                          {parts.map((part, pIdx) => {
                            if (part.startsWith("**") && part.endsWith("**")) {
                              return (
                                <strong key={pIdx} style={{ color: "#ffffff", fontWeight: 700 }}>
                                  {part.slice(2, -2)}
                                </strong>
                              );
                            }
                            return <span key={pIdx}>{part}</span>;
                          })}
                        </div>
                      );
                    })}
                  </div>

                  {/* Welcome Message Quick Suggestion Chips */}
                  {m.id === "welcome" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
                      {[
                        "💻 I want a coding laptop",
                        "🎮 Gaming setup under ₹70,000",
                        "🎧 Wireless Earbuds",
                        "🖥️ 4K Gaming Monitor",
                        "⚡ 1-Rupee Test Checkout",
                      ].map((promptText, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => handleSend(promptText)}
                          style={{
                            background: "rgba(99, 102, 241, 0.15)",
                            border: "1px solid rgba(99, 102, 241, 0.3)",
                            color: "#c7d2fe",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {promptText}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Render Full-Featured Interactive Product Cards */}
                {m.products && m.products.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                      gap: "12px",
                      marginTop: "6px",
                      width: "100%",
                    }}
                  >
                    {m.products.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border)",
                          borderRadius: "12px",
                          padding: "14px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span className="badge badge-accent" style={{ fontSize: "10px", padding: "2px 6px" }}>
                              {p.category || "Product"}
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--success)", fontWeight: 600 }}>
                              ● In Stock
                            </span>
                          </div>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.4, marginBottom: "12px" }}>
                            {p.description}
                          </div>
                        </div>

                        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                          <div>
                            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Price</div>
                            <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--text-primary)" }}>
                              ₹{(p.price / 100).toLocaleString("en-IN")}
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: "5px 8px", fontSize: "11px" }}
                              onClick={() => handleAddToCart(p.id)}
                            >
                              <Plus size={12} /> Add
                            </button>
                            <button
                              className="btn btn-primary"
                              style={{ padding: "5px 10px", fontSize: "11px", background: "var(--accent-gradient)" }}
                              onClick={() => handleDirectBuyNow(p.id)}
                            >
                              ⚡ Buy Now
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Render Upsell Recommendation Chips */}
                {m.recommendations && m.recommendations.length > 0 && (
                  <div style={{ background: "rgba(168, 85, 247, 0.08)", border: "1px solid rgba(168, 85, 247, 0.3)", borderRadius: "10px", padding: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#c084fc", marginBottom: "8px" }}>
                      <Sparkles size={14} /> Recommended Upsell Add-ons
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {m.recommendations.map((rec) => (
                        <div
                          key={rec.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            background: "var(--bg-card)",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: "1px solid var(--border)",
                            fontSize: "12px",
                          }}
                        >
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{rec.name}</span>
                          <span style={{ color: "var(--cyan)", fontWeight: 700 }}>₹{(rec.price / 100).toLocaleString("en-IN")}</span>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: "2px 8px", fontSize: "11px", color: "var(--success)" }}
                            onClick={() => handleAddToCart(rec.id)}
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actionable Conversational Checkout Bridge */}
                {m.role === "assistant" && m.id !== "welcome" && cart.items.length > 0 && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                    <button
                      className="btn btn-primary"
                      style={{
                        padding: "8px 14px",
                        fontSize: "12px",
                        fontWeight: 700,
                        background: "var(--accent-gradient)",
                        boxShadow: "0 0 12px rgba(99, 102, 241, 0.4)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                      onClick={handleOpenCheckoutPreview}
                    >
                      <CreditCard size={14} /> Accept & Proceed to Payment ({cart.formattedTotal})
                    </button>
                  </div>
                )}
              </div>

              {m.role === "user" && (
                <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <User size={16} color="white" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", gap: "10px", alignItems: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              <Sparkles size={16} className="animate-spin" color="var(--accent-primary)" />
              RazorAI is reasoning and searching catalog...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Demo Action Chips */}
        <div style={{ padding: "8px 20px", background: "var(--bg-secondary)", borderTop: "1px solid var(--border)", display: "flex", gap: "8px", overflowX: "auto" }}>
          <button
            className="btn btn-secondary"
            style={{ fontSize: "12px", padding: "4px 10px", whiteSpace: "nowrap", border: "1px solid var(--accent-primary)", color: "#818cf8" }}
            onClick={() => handleSend("I want to buy a coding laptop")}
          >
            💻 "I want to buy a coding laptop"
          </button>
          <button
            className="btn btn-secondary"
            style={{ fontSize: "12px", padding: "4px 10px", whiteSpace: "nowrap" }}
            onClick={() => handleSend("Show me the 1 rupee demo item")}
          >
            ⚡ "₹1 Live Demo Item"
          </button>
          <button
            className="btn btn-secondary"
            style={{ fontSize: "12px", padding: "4px 10px", whiteSpace: "nowrap" }}
            onClick={() => handleSend("I need a gaming laptop under ₹70,000")}
          >
            🎮 "Gaming laptop under ₹70k"
          </button>
          <button
            className="btn btn-secondary"
            style={{ fontSize: "12px", padding: "4px 10px", whiteSpace: "nowrap" }}
            onClick={() => handleSend("Yes, recommend accessories for this laptop")}
          >
            🖱️ "Recommend accessories"
          </button>
          <button
            className="btn btn-secondary"
            style={{ fontSize: "12px", padding: "4px 10px", whiteSpace: "nowrap" }}
            onClick={handleOpenCheckoutPreview}
          >
            🔒 "Proceed to Checkout"
          </button>
        </div>

        {/* Input Bar with Voice Recognition */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px", alignItems: "center", background: "var(--bg-card)" }}>
          <button
            type="button"
            className="btn"
            onClick={toggleListening}
            title={isListening ? "Listening... (Click to stop)" : "Click to speak with voice"}
            style={{
              background: isListening ? "rgba(239, 68, 68, 0.2)" : "var(--bg-secondary)",
              border: isListening ? "1px solid var(--danger)" : "1px solid var(--border)",
              color: isListening ? "var(--danger)" : "var(--text-secondary)",
              padding: "10px 12px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              fontWeight: 600,
              boxShadow: isListening ? "0 0 12px rgba(239, 68, 68, 0.5)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            {isListening ? (
              <>
                <MicOff size={16} color="var(--danger)" />
                <span style={{ color: "var(--danger)", fontSize: "12px" }}>Listening...</span>
              </>
            ) : (
              <Mic size={16} />
            )}
          </button>

          <input
            type="text"
            placeholder={isListening ? "Listening to your voice..." : "Type or speak to RazorAI (e.g. 'I want to buy a coding laptop')..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            style={{
              flex: 1,
              background: "var(--bg-secondary)",
              border: isListening ? "1px solid var(--danger)" : "1px solid var(--border)",
              borderRadius: "8px",
              padding: "10px 14px",
              color: "white",
              fontSize: "14px",
              outline: "none",
            }}
          />
          <button className="btn btn-primary" onClick={() => handleSend()} disabled={loading || !input.trim()}>
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Cart & Gated Checkout Sidebar */}
      <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "15px", fontWeight: 700 }}>
            <ShoppingBag size={18} color="var(--accent-primary)" /> Live Cart
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {cart.items.length > 0 && (
              <button
                onClick={handleClearCart}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--danger)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
                title="Clear entire cart"
              >
                Clear
              </button>
            )}
            <span className="badge badge-accent">{cart.items.length} items</span>
          </div>
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
          {cart.items.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0", fontSize: "13px" }}>
              Your cart is currently empty. Ask the AI agent to search and add items!
            </div>
          ) : (
            cart.items.map((item) => (
              <div key={item.id} style={{ background: "var(--bg-secondary)", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
                    {item.product.name}
                  </div>
                  <button
                    onClick={() => handleRemoveFromCart(item.productId)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: "2px",
                      display: "flex",
                      alignItems: "center",
                      borderRadius: "4px",
                      transition: "color 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                    title="Remove item from cart"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px" }}>
                  <span>Qty: {item.quantity}</span>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                    ₹{((item.product.price * item.quantity) / 100).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Total & Checkout Button */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px", marginTop: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", fontWeight: 800, marginBottom: "12px" }}>
            <span>Total:</span>
            <span style={{ color: "var(--success)" }}>{cart.formattedTotal}</span>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: "100%", padding: "12px" }}
            onClick={handleOpenCheckoutPreview}
            disabled={cart.items.length === 0}
          >
            <CreditCard size={16} /> Request Payment Approval
          </button>
        </div>
      </div>

      {/* APPROVAL & PAYMENT MODAL */}
      {showApprovalModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "600px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "17px", fontWeight: 800 }}>
                <ShieldAlert size={20} color="var(--accent-primary)" />
                Razorpay Checkout Options
              </div>
              <button
                onClick={() => setShowApprovalModal(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs Selection */}
            {paymentStatus === "IDLE" && (
              <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: "16px", gap: "4px" }}>
                {[
                  { id: "checkout", label: "💳 Pay Now" },
                  { id: "affordability", label: "⚡ EMI / BNPL" },
                  { id: "share", label: "🔗 Share Link" }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setModalTab(t.id as any)}
                    style={{
                      padding: "8px 16px",
                      background: "transparent",
                      border: "none",
                      color: modalTab === t.id ? "#818cf8" : "var(--text-secondary)",
                      borderBottom: modalTab === t.id ? "2px solid #818cf8" : "2px solid transparent",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s"
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {paymentStatus === "IDLE" ? (
              <div>
                {modalTab === "checkout" && (
                  <div>
                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px" }}>
                      The AI sales agent generated an itemized checkout order. Customer approval is required before payment can proceed.
                    </p>

                    {/* Itemized breakdown */}
                    <div style={{ background: "var(--bg-card)", borderRadius: "10px", padding: "12px", border: "1px solid var(--border)", marginBottom: "16px" }}>
                      {preview?.items?.map((i: any, idx: number) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "4px 0", borderBottom: idx < preview.items.length - 1 ? "1px solid var(--border)" : "none" }}>
                          <span>{i.name} × {i.quantity}</span>
                          <span style={{ fontWeight: 600 }}>₹{(i.total / 100).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: 800, marginTop: "8px", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
                        <span>Authoritative Total:</span>
                        <span style={{ color: "var(--success)" }}>{preview?.formattedTotal}</span>
                      </div>
                    </div>

                    {/* Policy Checks Banner */}
                    <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "8px", padding: "10px", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                      ✓ Stock available & verified<br />
                      ✓ Price calculated server-side<br />
                      ✓ Within merchant transaction limits (≤ ₹1,00,000)
                    </div>

                    {/* Action Buttons for Demo */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <button className="btn btn-primary" style={{ padding: "12px" }} onClick={handleApprovePayment} disabled={processingPayment}>
                        <Check size={16} /> Approve & Pay ₹{(preview?.total / 100).toLocaleString("en-IN")}
                      </button>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "4px" }}>
                        <button
                          className="btn btn-danger"
                          style={{ fontSize: "12px" }}
                          onClick={handleSimulateFailure}
                          disabled={processingPayment}
                        >
                          <AlertCircle size={14} /> Demo Scene 2 (Simulate Failure)
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: "12px" }}
                          onClick={() => setShowApprovalModal(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {modalTab === "affordability" && (
                  <div>
                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px" }}>
                      Eligible credit EMI options and Buy Now Pay Later networks fetched dynamically via Razorpay Affordability.
                    </p>

                    {loadingAffordability ? (
                      <div style={{ textAlign: "center", padding: "30px" }}>
                        <RefreshCw size={24} className="animate-spin" color="var(--accent-primary)" />
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>Loading payment options...</div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {/* CC EMI Section */}
                        {affordabilityData?.emiPlans && affordabilityData.emiPlans.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Credit Card EMI Options</span>
                              {/* Select Bank */}
                              <select
                                value={selectedBankIdx}
                                onChange={(e) => setSelectedBankIdx(Number(e.target.value))}
                                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "white", padding: "4px 8px", borderRadius: "6px", fontSize: "12px" }}
                              >
                                {affordabilityData.emiPlans.map((bank: any, idx: number) => (
                                  <option key={bank.bankCode} value={idx}>{bank.bankName}</option>
                                ))}
                              </select>
                            </div>

                            {/* Plan Grid */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                              {affordabilityData.emiPlans[selectedBankIdx]?.plans?.map((plan: any) => (
                                <div key={plan.months} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", padding: "10px", borderRadius: "8px", display: "flex", flexDirection: "column" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, color: "#818cf8" }}>
                                    <span>{plan.months} Months</span>
                                    <span>{plan.interestRate}% pa</span>
                                  </div>
                                  <div style={{ fontSize: "16px", fontWeight: 800, marginTop: "4px" }}>{plan.formattedEmi}/mo</div>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                                    <span>Total Cost: {plan.formattedTotalCost}</span>
                                    <span>Interest: {plan.formattedInterestCharged}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* BNPL Section */}
                        {affordabilityData?.bnpl && affordabilityData.bnpl.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Buy Now Pay Later (BNPL) networks</span>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {affordabilityData.bnpl.map((provider: any) => (
                                <div key={provider.provider} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card)", border: "1px solid var(--border)", padding: "10px 14px", borderRadius: "8px" }}>
                                  <div>
                                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>{provider.provider}</span>
                                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{provider.description}</div>
                                  </div>
                                  <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--success)" }}>{provider.formattedInstallment}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {modalTab === "share" && (
                  <div style={{ textAlign: "center", padding: "10px 0" }}>
                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px", textAlign: "left" }}>
                      Generate an authenticated Razorpay Payment Link. You can send this short link to the customer via SMS/Email, or let them scan the QR code to pay on a mobile device.
                    </p>

                    {!paymentLinkUrl ? (
                      <button
                        className="btn btn-primary"
                        onClick={handleCreatePaymentLink}
                        disabled={creatingPaymentLink}
                        style={{ padding: "12px 24px", background: "var(--accent-gradient)", boxShadow: "0 0 15px rgba(99, 102, 241, 0.4)" }}
                      >
                        {creatingPaymentLink ? <RefreshCw size={16} className="animate-spin" /> : <QrCode size={16} />}
                        {creatingPaymentLink ? "Creating Payment Link..." : "Create Razorpay Payment Link & QR"}
                      </button>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                        {/* Copy Link Input */}
                        <div style={{ display: "flex", width: "100%", gap: "8px" }}>
                          <input
                            type="text"
                            value={paymentLinkUrl}
                            readOnly
                            style={{ flex: 1, background: "var(--bg-secondary)", border: "1px solid var(--border)", padding: "8px 12px", color: "var(--cyan)", borderRadius: "8px", fontSize: "13px", fontWeight: 600 }}
                          />
                          <button className="btn btn-secondary" onClick={handleCopyLink} style={{ gap: "4px" }}>
                            {copiedLink ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                            {copiedLink ? "Copied!" : "Copy"}
                          </button>
                        </div>

                        {/* QR Code Container */}
                        <div style={{ background: "white", padding: "14px", borderRadius: "12px", display: "inline-flex", flexDirection: "column", alignItems: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(paymentLinkUrl)}&size=150x150`}
                            alt="Payment Link QR Code"
                            style={{ width: "150px", height: "150px" }}
                          />
                          <span style={{ fontSize: "11px", color: "#374151", fontWeight: 700, marginTop: "8px" }}>Scan to Pay with Phone</span>
                        </div>

                        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                          Attribution order: <code>{orderResult?.orderId}</code>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : paymentStatus === "SUCCESS" ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <CheckCircle2 size={48} color="var(--success)" style={{ margin: "0 auto 12px auto" }} />
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Payment Verified & Captured!</h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "6px" }}>
                  Razorpay Order ID: <code style={{ color: "var(--cyan)" }}>{orderResult?.razorpayOrderId}</code>
                </p>
                <div style={{ background: "var(--bg-card)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", margin: "16px 0", fontSize: "13px" }}>
                  Order status updated to <strong>PAID</strong> in PostgreSQL.<br />
                  Immutable Audit Log recorded.
                </div>
                <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setShowApprovalModal(false)}>
                  Done
                </button>
              </div>
            ) : (
              /* FAILURE STATE & RETRY */
              <div style={{ padding: "8px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--danger)", marginBottom: "12px" }}>
                  <XCircle size={28} />
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Payment Unsuccessful</h3>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>No successful payment was recorded for this order.</div>
                  </div>
                </div>

                <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px" }}>
                  <strong>Reason:</strong> {failureReason}<br />
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Order ID: <code>{orderResult?.orderId}</code> (Status: FAILED)
                  </span>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleRetryPayment} disabled={processingPayment}>
                    <RefreshCcw size={16} /> Try Again (Retry Payment)
                  </button>
                  <button className="btn btn-secondary" onClick={() => setShowApprovalModal(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
