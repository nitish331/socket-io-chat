import Icon from "../Icon";

const LABELS = {
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
};

function Ticks({ status }) {
  return (
    <span className={`ticks ${status}`} role="img" aria-label={LABELS[status]} title={LABELS[status]}>
      <Icon name={status === "sent" ? "check" : "checkDouble"} size={15} strokeWidth={2.4} />
    </span>
  );
}

export default Ticks;
