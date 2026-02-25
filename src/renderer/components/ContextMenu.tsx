import React, { useEffect, useRef, useState } from 'react';

export interface MenuItem {
    label?: string;
    onClick?: () => void;
    disabled?: boolean;
    submenu?: MenuItem[];
    isDivider?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: MenuItem[];
    onClose: () => void;
}

const MenuList: React.FC<{ items: MenuItem[]; onClose: () => void; isSubmenu?: boolean }> = ({ items, onClose, isSubmenu }) => {
    const [activeSubmenu, setActiveSubmenu] = useState<number | null>(null);
    const menuW = 200;

    return (
        <div style={{
            position: isSubmenu ? 'absolute' : 'fixed',
            left: isSubmenu ? '100%' : undefined,
            top: isSubmenu ? '-4px' : undefined,
            width: menuW,
            backgroundColor: isSubmenu ? 'rgba(30, 30, 40, 0.98)' : 'rgba(30, 30, 40, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            padding: '4px 0',
            zIndex: 10000,
            color: '#eee',
            fontSize: '0.9rem',
        }}>
            {items.map((item, index) => (
                <div key={index} style={{ position: 'relative' }}>
                    {item.isDivider ? (
                        <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />
                    ) : (
                        <div
                            onMouseEnter={() => setActiveSubmenu(item.submenu ? index : null)}
                            onClick={(e) => {
                                if (item.submenu) {
                                    e.stopPropagation();
                                    return;
                                }
                                if (!item.disabled && item.onClick) {
                                    item.onClick();
                                    onClose();
                                }
                            }}
                            style={{
                                padding: '6px 16px',
                                cursor: item.disabled ? 'default' : 'pointer',
                                opacity: item.disabled ? 0.5 : 1,
                                backgroundColor: activeSubmenu === index ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <span>{item.label}</span>
                            {item.submenu && <span style={{ fontSize: '0.7rem', marginLeft: 8 }}>▶</span>}

                            {item.submenu && activeSubmenu === index && (
                                <MenuList items={item.submenu} onClose={onClose} isSubmenu />
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    // Adjust position if menu goes off screen
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const menuW = 200;
    const menuH = items.length * 30;

    let left = x;
    let top = y;

    if (x + menuW > screenW) left = x - menuW;
    if (y + menuH > screenH) top = y - menuH;

    return (
        <div ref={containerRef} style={{ position: 'fixed', left, top, zIndex: 9999 }}>
            <MenuList items={items} onClose={onClose} />
        </div>
    );
};

export default ContextMenu;
