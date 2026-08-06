const Lumea = () => (
  <div
    className="fixed left-0 top-0 bg-[#05060a] overflow-hidden"
    style={{ width: "100vw", height: "100vh", zIndex: 30 }}
  >
    <iframe
      src="/lumea/index.html"
      title="Lumea — Design Studio"
      style={{ width: "100%", height: "100%", border: 0, display: "block" }}
      allow="fullscreen"
    />
  </div>
);

export default Lumea;
