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
import type { SubscriptionFilter } from '../MetricsStore';
import type {
    CrudRecord,
    CrudRecordsStore,
    CrudSubscriptionMetrics,
} from '../crud/CrudRecordsStore';

/**
 * Defines a store that is able to store and retrieve information about proxies.
 */
export interface ProxyRecordsStore extends CrudRecordsStore<ProxyRecord> {
    /**
     * Gets the item metrics for the subscription of the given user or studio.
     * @param filter The filter to use.
     */
    getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<ProxySubscriptionMetrics>;

    /**
     * Records that the given proxy was called.
     * @param request The information about the request that was made.
     */
    recordProxyRequest(request: ProxyRequestInfo): Promise<void>;
}

/**
 * Defines a record that represents a proxy.
 *
 * Proxies are able to store secret information (like API keys) that is applied to requests
 * that are sent through the proxy. This makes it possible for an experience to use a service
 * that is secured by an API key without ever shipping the API key to the client.
 *
 * @dochash types/records/proxies
 * @docName ProxyRecord
 */
export interface ProxyRecord extends CrudRecord {
    /**
     * The host that requests made to this proxy should be sent to.
     * (e.g. `example.com:8443`)
     */
    host: string;

    /**
     * The properties that should be applied to the target request.
     *
     * Each key represents a property on the target request and each value
     * represents the value that the property should be set to.
     *
     * The following properties are supported:
     * - `body.{x}` - Sets the given property in the JSON body of the target request.
     *   If the request doesn't contain JSON data, then the request is rejected.
     * - `headers.authorization` - Sets the `authorization` header on the target request.
     * - `headers.authorization.bearer` - Sets the `authorization` header on the target request to `Bearer {value}`.
     */
    data: ProxyRecordData;
}

/**
 * Defines the set of properties that a proxy applies to the requests that it makes.
 *
 * @dochash types/records/proxies
 * @docName ProxyRecordData
 */
export interface ProxyRecordData {
    [key: string]: string | number | boolean | null;
}

/**
 * Defines information about a request that was sent through a proxy.
 */
export interface ProxyRequestInfo {
    /**
     * The name of the record that the proxy is in.
     */
    recordName: string;

    /**
     * The address of the proxy.
     */
    proxyAddress: string;

    /**
     * The unix time in miliseconds when the proxy request was recieved.
     */
    requestTimeMs: number;
}

/**
 * Defines the subscription metrics for proxies.
 */
export interface ProxySubscriptionMetrics extends CrudSubscriptionMetrics {
    /**
     * The total number of proxy items that are stored in the subscription.
     */
    totalItems: number;

    /**
     * The number of proxy requests that have been made during the last subscription period.
     */
    totalRequestsInPeriod: number;

    /**
     * The number of proxy requests that have been made in the last hour.
     */
    totalRequestsInLastHour: number;
}
