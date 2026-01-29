import { createPortal } from 'react-dom';

/**
 * Renders children into document.body so modals appear above GNB (z-50).
 * Wrap the modal's fixed overlay div with this component.
 */
const ModalPortal = ({ children }) => {
    if (children == null) return null;
    return createPortal(children, document.body);
};

export default ModalPortal;
