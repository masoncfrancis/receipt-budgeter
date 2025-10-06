'use client';

import { useOidc } from '../oidc'


function LoginLanding() {
    // assert that we're on the not-logged-in path so the hook typings reflect that
    const { login } = useOidc({ assert: 'user not logged in' })

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
            <div className="bg-white/5 dark:bg-gray-800 p-10 rounded-xl shadow-2xl w-full max-w-lg border border-gray-700 transition-colors duration-300 text-center">
                <h1 className="text-4xl font-extrabold mb-6 text-gray-800 dark:text-white transition-colors duration-300">
                    Receipt Reader
                </h1>
                <p className="text-lg mb-8 text-gray-200 transition-colors duration-300">
                    You must log in to continue
                </p>
                <div className="flex flex-col gap-4">
                    <button
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-300 ease-in-out transform hover:scale-105 shadow-lg"
                        onClick={() => login()}
                    >
                        Log In
                    </button>
                </div>
            </div>
        </div>
    );
}

export default LoginLanding;