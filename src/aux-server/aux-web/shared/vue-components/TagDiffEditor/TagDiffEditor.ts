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
import MonacoLoader from '../MonacoLoader/MonacoLoader';
import MonacoLoaderError from '../MonacoLoaderError/MonacoLoaderError';
import EmptyComponent from '../EmptyComponent/EmptyComponent';

const MonacoAsync = () => ({
    component:
        import.meta.env.MODE === 'static'
            ? Promise.resolve(EmptyComponent)
            : import('../MonacoTagDiffEditor/MonacoTagDiffEditor').catch(
                  (err) => {
                      console.error('Unable to load Monaco diff editor:', err);
                      throw err;
                  }
              ),
    loading: MonacoLoader,
    error: MonacoLoaderError,

    delay: 50,
    timeout: 1000 * 60 * 5, // 5 minutes
});

export default MonacoAsync;
