import * as React from 'react';
import { createReactOidc } from 'oidc-spa/react';
import { z } from 'zod';

// Vite environment flag to allow anonymous (no-login) mode.
const ALLOW_ANONYMOUS =
    typeof import.meta !== 'undefined' &&
    Boolean(
        (import.meta as any).env?.VITE_ALLOW_ANONYMOUS === '1' ||
            (import.meta as any).env?.VITE_ALLOW_ANONYMOUS === 'true'
    );

// We'll export these names; assign them conditionally below.
let OidcProvider: any;
let useOidc: any;
let getOidc: any;

if (ALLOW_ANONYMOUS) {
    // Lightweight fake implementations for anonymous mode.
    OidcProvider = ({ children }) => React.createElement(React.Fragment, null, children);
    useOidc = () => ({ isUserLoggedIn: true, user: { name: 'Anonymous', sub: 'anonymous' } });
    getOidc = async () => ({
        isUserLoggedIn: true,
        user: { name: 'Anonymous', sub: 'anonymous' },
        signIn: async () => {},
        signOut: async () => {},
        // keep getTokens so fetchWithAuth can call it safely
        getTokens: async () => ({ accessToken: '' })
    });
} else {
    const created = createReactOidc(async () => ({
        issuerUri: import.meta.env.VITE_OIDC_ISSUER,
        clientId: import.meta.env.VITE_OIDC_CLIENT_ID,
        /**
         * Vite:  `homeUrl: import.meta.env.BASE_URL`
         * CRA:   `homeUrl: process.env.PUBLIC_URL`
         * Other: `homeUrl: "/"` (Usually, can be something like "/dashboard")
         */
        homeUrl: import.meta.env.BASE_URL,
        // autoLogin: true,
        //scopes: ["profile", "email", "api://my-app/access_as_user"],
        extraQueryParams: () => ({
            ui_locales: 'en' // Keycloak login/register page language
            //audience: "https://my-app.my-company.com/api"
        }),
        decodedIdTokenSchema: z.object({
            // some identity providers omit preferred_username or name; accept either as optional
            preferred_username: z.string().optional(),
            name: z.string().optional()
            //email: z.string().email().optional()
        })
    }));

    OidcProvider = created.OidcProvider;
    useOidc = created.useOidc;
    getOidc = created.getOidc;
}

export { OidcProvider, useOidc, getOidc };

export const fetchWithAuth: typeof fetch = async (input, init) => {
    const oidc = await getOidc();

    if (oidc.isUserLoggedIn) {
        const { accessToken } = (await oidc.getTokens()) || {};

        (init ??= {}).headers = {
            ...init.headers,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        };
    }

    return fetch(input, init);
};