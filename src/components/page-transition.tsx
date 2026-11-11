import { useLocation, useOutlet } from "react-router";

// The incoming page fades in for 0.15s. The previous page unmounts at once:
// holding it for an exit left its header in the accessibility tree.
export function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();

  return (
    <div className="relative" data-app-scroll>
      <div key={location.pathname} className="lvxu-page-in">
        {outlet}
      </div>
    </div>
  );
}
