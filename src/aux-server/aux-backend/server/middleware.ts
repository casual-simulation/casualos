/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type express from 'express';
import type { Request, Response } from 'express';

/**
 * Conditionally executes the given middleware if the test function returns true.
 * @param test The test function to evaluate.
 * @param middleware The middleware to execute if the test passes.
 */
export function conditional(
    test: (request: Request, response: Response) => boolean,
    middleware: express.RequestHandler
): express.RequestHandler {
    return (req, res, next) => {
        if (test(req, res)) {
            return middleware(req, res, next);
        } else {
            // else, skip to next middleware
            next();
        }
    };
}
