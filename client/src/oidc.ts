import { createReactOidc } from "oidc-spa/react";
import { z } from "zod";

export const { OidcProvider, useOidc, getOidc } =
    createReactOidc(async () => ({
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
            ui_locales: "en" // Keycloak login/register page language
            //audience: "https://my-app.my-company.com/api"
        }),
        decodedIdTokenSchema: z.object({
            // some identity providers omit preferred_username or name; accept either as optional
            preferred_username: z.string().optional(),
            name: z.string().optional()
            //email: z.string().email().optional()
        })
    }));

export const fetchWithAuth: typeof fetch = async (
    input,
    init
) => {
    const oidc = await getOidc();
    
    if (oidc.isUserLoggedIn) {
        const { accessToken } = await oidc.getTokens();

        (init ??= {}).headers = {
            ...init.headers,
            Authorization: `Bearer ${accessToken}`
        };
    }

    return fetch(input, init);
};