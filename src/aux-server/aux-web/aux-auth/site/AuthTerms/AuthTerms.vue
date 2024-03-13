<template>
    <div class="terms-container">
        <md-card>
            <md-card-header>
                <h1 class="md-title">{{ hostname }} Terms of Service</h1>
            </md-card-header>
            <md-card-content>
                <p>
                    You can find a plain-text version of these terms
                    <a href="/terms-of-service.txt">here</a>.
                </p>
                <p>
                    By using Our products or services, You agree to these Terms of Service as well
                    as Our
                    <router-link to="/acceptable-use-policy">Acceptable Use Policy</router-link>
                    and
                    <router-link to="/privacy-policy">Privacy Policy</router-link>.
                </p>

                <div v-html="termsHtml"></div>
                <!-- <terms-content></terms-content> -->

                <!-- <p><em>Last updated on November 16th, 2022</em></p>
                <p>
                    You can find a plain-text version of these terms
                    <a href="/terms-of-service.txt">here</a>.
                </p>
                <p>
                    By using Our products or services, You agree to these Terms of Service as well
                    as Our <a href="/acceptable-use-policy">Acceptable Use Policy</a>
                    and
                    <a href="/privacy-policy">Privacy Policy</a>.
                </p>
                <p>
                    We welcome You to use ab1.bot! Casual Simulation offers tools for authoring open
                    source experiences.
                </p>
                <p>
                    Please review the entirety of these terms carefully as they apply how Your data
                    is used, the rights You have to the content You create or share, and more.
                </p>
                <div class="terms-of-service-content">
                    <h3 id="toc">
                        <ol start="0">
                            <li>Table of Contents</li>
                        </ol>
                    </h3>
                    <div class="table-of-contents">
                        <ol start="0">
                            <li><a href="#toc">Table of Contents</a></li>
                            <li><a href="#about-terms">About These Terms</a></li>
                            <li><a href="#personal-use-only">Personal Use Only</a></li>
                            <li>
                                <a href="#about-accessing-and-using-Our-services"
                                    >About Accessing And Using Our Services</a
                                >
                            </li>
                            <li>
                                <a href="#content-permissions"
                                    >Content Permissions, Restrictions, and Licensing</a
                                >
                            </li>
                            <li>
                                <a href="#Your-risk-in-accessing-user-content"
                                    >Your Risk In Accessing Licensed User Content</a
                                >
                            </li>
                            <li><a href="#olx-services">OLX Services</a></li>
                            <li><a href="#warranty-disclaimer">Warranty Disclaimer</a></li>
                            <li><a href="#limitation-of-liability">Limitation of Liability</a></li>
                            <li><a href="#indemnity">Indemnity</a></li>
                            <li><a href="#intellectual-property">Intellectual Property</a></li>
                            <li><a href="#privacy">Privacy</a></li>
                            <li><a href="#mandatory-arbitration">Mandatory Arbitration</a></li>
                            <li><a href="#general-terms">General Terms</a></li>
                        </ol>
                    </div>
                    <h3 id="about-terms">
                        <ol start="1">
                            <li>About These Terms</li>
                        </ol>
                    </h3>
                    <p>
                        These Terms of Service pertain to the legal obligations You assume when You
                        access the following websites:
                    </p>
                    <ul>
                        <li><a href="https://ab1.bot">ab1.bot</a></li>
                        <li><a href="https://alpha.ab1.bot">alpha.ab1.bot</a></li>
                        <li><a href="https://static.ab1.bot">static.ab1.bot</a></li>
                        <li><a href="https://stable.ab1.bot">stable.ab1.bot</a></li>
                        <li><a href="https://ab1.link">ab1.link</a></li>
                        <li><a href="https://casualos.com">casualos.com</a></li>
                        <li><a href="https://alpha.casualos.com">alpha.casualos.com</a></li>
                        <li><a href="https://static.casualos.com">static.casualos.com</a></li>
                        <li><a href="https://stable.casualos.com">stable.casualos.com</a></li>
                        <li><a href="https://publicos.com">publicos.com</a></li>
                        <li><a href="https://publicos.link">publicos.link</a></li>
                        <li><a href="https://auxplayer.com">auxplayer.com</a></li>
                        <li><a href="https://alpha.auxplayer.com">alpha.auxplayer.com</a></li>
                        <li><a href="https://static.auxplayer.com">static.auxplayer.com</a></li>
                        <li><a href="https://stable.auxplayer.com">stable.auxplayer.com</a></li>
                        <li><a href="https://auxplayer.org">auxplayer.org</a></li>
                        <li><a href="https://static.auxplayer.org">static.auxplayer.org</a></li>
                        <li><a href="https://stable.auxplayer.org">stable.auxplayer.org</a></li>
                        <li><a href="https://auxbackend.com">auxbackend.com</a></li>
                        <li><a href="https://webhook.auxbackend.com">webhook.auxbackend.com</a></li>
                        <li>
                            <a href="https://websocket.auxbackend.com">websocket.auxbackend.com</a>
                        </li>
                        <li><a href="https://docs.casualos.com">docs.casualos.com</a></li>
                        <li><a href="https://docs.ab1.bot">docs.ab1.bot</a></li>
                    </ul>
                    <p>
                        These Terms of Service further relate to any access points, endpoints,
                        webhooks, or any other services provided at the below above listed domains
                        ("Services") and create a legal agreement between You ("You" or "Your") and
                        Casual Simulation, Inc, a 501(c)(3) not-for-profit company registered in
                        Michigan whose address is 879 4 Mile RD NE, Grand Rapids, MI, 49525 ("Casual
                        Simulation," "We," "Us," or "Our").
                    </p>
                    <p>
                        If You are using the Services on behalf of You personally, "You" means You
                        individually; if You represent an organization, "You" means Your
                        organization. You agree that by accessing Our Services, You are agreeing to
                        these Terms of Service, Our Acceptable Use Policy, and Privacy Policy. If
                        You do not agree with these Terms of Service THEN YOU SHOULD NOT ACCESS OUR
                        SERVICES.
                    </p>
                    <p>
                        PLEASE BE AWARE THAT BY USING THE SERVICES, EXCEPT FOR CERTAIN TYPES OF
                        DISPUTES DESCRIBED IN THE SECTION TITLED "MANDATORY ARBITRATION" BELOW, YOU
                        AGREE THAT ALL DISPUTES BETWEEN YOU AND US WILL BE RESOLVED BY BINDING,
                        INDIVIDUAL ARBITRATION AND YOU WAIVE YOUR RIGHT TO PARTICIPATE IN A CLASS
                        ACTION LAWSUIT OR CLASS-WIDE ARBITRATION.
                    </p>
                    <p>
                        You must be at least 13 years old to access or use the Services. By
                        accessing or using the Services in any manner, You represent and warrant
                        that You are at least 13 years of age. If You are under 13 years old, You
                        may not, under any circumstances or for any reason, access or use the
                        Services in any manner, and may not provide any personal information to or
                        on the Services (including, for example, a name, address, telephone number
                        or email address).
                    </p>
                    <p>
                        If You are located within the European Union, You must be at least 16 years
                        old to access or use the Services. By accessing or using the Services in any
                        manner, You represent and warrant that You are at least 16 years of age. If
                        You are under 16 years old, You may not, under any circumstances or for any
                        reason, access or use the Services in any manner, and may not provide any
                        personal information to or on the Services (including, for example, a name,
                        address, telephone number or email address).
                    </p>
                    <p>
                        These Terms of Service, and any rights and licenses granted hereunder, may
                        not be transferred or assigned by You, but may be assigned by Us without
                        restriction.
                    </p>
                    <p>
                        <span>You can access these Terms of Service at any time at </span
                        ><a href="/terms">{{ origin }}/terms</a>. We can make changes to these Terms
                        of Service at any time and Your continued use of Our Services shall confirm
                        Your acceptance of the updated Terms of Service whether You have read them
                        or not. To reiterate, and for clarity, these Terms of Service apply to all
                        who access or use the Services, including without limitation users who
                        contribute or author content, information, and other materials or services,
                        registered or otherwise, in any way.
                    </p>
                    <h3 id="personal-use-only">
                        <ol start="2">
                            <li>Personal Use Only</li>
                        </ol>
                    </h3>
                    <p>
                        The Services are made available for Your personal use only so that
                        individuals may practice, learn, and experiment with the Services unless You
                        have a separate written agreement with Us. You may not "scrape" the Services
                        without written permission by Us. ab1.bot is an implementation of CasualOS
                        (<a href="https://github.com/casual-simulation/casualos"
                            >https://github.com/casual-simulation/casualos</a
                        >) and We grant You permission to use the Services to create, display, copy,
                        and download content for personal, non-commercial, and commercial use
                        provided that You not remove or alter any copyright or other proprietary
                        notices contained in the content. If You have any questions or would like an
                        exception please email Us at
                        <a href="mailto:hello@casualsimulation.org">hello@casualsimulation.org</a>
                        , and We will respond promptly. Speaking broadly, Our desire to maximize the
                        impact and use of the Services without restriction provided it does not
                        adversely impact Our ability to provide Services to the general public or
                        burden Us with additional liability.
                    </p>
                    <p>
                        ANY ORGANIZATION THAT WOULD LIKE TO MAKE MAKE USE OF OUR SERVICES MUST
                        NOTIFY US AND, IF APPLICABLE, ALLOW US TO ENTER INTO A SEPARATE AGREEMENT IN
                        ADVANCE TO ENSURE GENERAL QUALITY OF SERVICE IS NOT ADVERSELY IMPACTED.
                    </p>
                    <p>
                        Our Services are intended to be free of charge to the general public,
                        governments, public institutions, educational institutions, and nonprofits
                        so long as We have the means and funds to provide said Services. Our
                        Services as regards commercial entities are intended to cover Our costs and
                        ensure continued development and improvement of Our Services. If You
                        represent an organization (even an organization We intend to provide free
                        Services to) You must notify Us before using Our Services on behalf of Your
                        organization so We may ensure We can support Your use case(s) without
                        adversely impacting Our Services intended to be provided free of charge to
                        the general public.
                    </p>
                    <p>
                        Any organization that would like to make commercial use of Our Services must
                        enter into a separate agreement with Us in advance to ensure general quality
                        of service is not adversely impacted. Please contact Us at
                        <a href="mailto:hello@casualsimulation.com">hello@casualsimulation.com</a>
                        and We will promptly follow up with You.
                    </p>
                    <h3 id="about-accessing-and-using-Our-services">
                        <ol start="3">
                            <li>About Accessing And Using Our Services</li>
                        </ol>
                    </h3>
                    <p>
                        You are responsible for the internet connection and/or mobile charges that
                        You may incur for accessing Our Services. You should ask Your mobile
                        operator if You are unsure what these charges will be before You access Our
                        Services.
                    </p>
                    <p>
                        We make no claims that Content (defined in Article 4) created by others
                        utilizing the Services may be lawfully viewed or downloaded outside of the
                        United States. Access to Services may not be legal by certain persons or in
                        certain countries. If You access the Services from outside of the United
                        States, You do so at Your own risk and are responsible for compliance with
                        the laws of Your jurisdiction. These Terms of Service are void where
                        prohibited by law, and the right to access the Services is revoked in such
                        jurisdictions.
                    </p>
                    <p>
                        You may not "scrape" the website or Services without Our written permission.
                    </p>
                    <p>
                        While We try to ensure that the information on Our Services is complete and
                        accurate, We do not warrant the accuracy and/or completeness of any
                        information on Our Services nor do We guarantee availability of Our
                        Services. We also make no commitment to keep the information on Our Services
                        up to date. The material on Our Services is provided "as is" without any
                        conditions, representations, warranties or other terms of any kind. Under no
                        circumstances will We be liable in any way for any information on Our
                        Services, including, but not limited to, the Services being unavailable, any
                        errors or omissions in any information, or any losses or harm of any kind
                        resulting from the use of any information made available via Our Services.
                    </p>
                    <p>
                        We have the right to withdraw or modify Our Services (in whole or in part)
                        without notice and without liability to You from time to time:
                    </p>
                    <ul>
                        <li>
                            for technical reasons (such as technical difficulties experienced by Us
                            or on the internet);
                        </li>
                        <li>to allow Us to improve the experience;</li>
                        <li>
                            where We have legal reasons for doing so (including privacy or other
                            legal objections to the content or conduct of Our Services);
                        </li>
                        <li>
                            because it no longer makes business sense for Us to provide the relevant
                            part of the Services; or
                        </li>
                        <li>because We have altered the Services We provide.</li>
                    </ul>
                    <p>
                        There may also be times when Our Services or any part of it is not available
                        for technical or maintenance related reasons, whether on a scheduled or
                        unscheduled basis.
                    </p>
                    <h3 id="content-permissions">
                        <ol start="4">
                            <li>Content Permissions, Restrictions, and Licensing</li>
                        </ol>
                    </h3>
                    <p>
                        You irrevocably grant Us a license as defined in this Article 4 to any and
                        all Content or forms of media, including without limitation any and all
                        text, software or source code, procedurally, manually, or artificially
                        generated data, graphics, logos, tools, photographs, images, illustrations,
                        audio and video, meshes, animations, modifications, derivatives, and any
                        related product or service feedback, that You create with or You provide to
                        the Services that You possess the rights to (collectively, “User Content”)
                        to the fullest extent provided by law.
                    </p>
                    <p>
                        YOU HEREBY GRANT US A NONEXCLUSIVE, IRREVOCABLE PERPETUAL, TRANSFERABLE,
                        ASSIGNABLE, SUB-LICENSEABLE, ROYALTY-FREE, WORLDWIDE LICENSE TO ALL USER
                        CONTENT TO RELIABLY AND WITHOUT FEAR OF LATER CLAIMS OF INFRINGEMENT BUILD
                        UPON, MODIFY, INCORPORATE IN OTHER WORKS, REUSE AND REDISTRIBUTE AS FREELY
                        AS POSSIBLE IN ANY FORM WHATSOEVER AND FOR ANY PURPOSES, INCLUDING WITHOUT
                        LIMITATION COMMERCIAL PURPOSES WITHOUT ANY EXPECTATION OF ADDITIONAL
                        CONSIDERATION OR COMPENSATION FOR THE CHARITABLE PURPOSE OF MAKING SUCH USER
                        CONTENT AVAILABLE TO THE GENERAL PUBLIC (“Licensed User Content”).
                    </p>
                    <p>
                        YOU HEREBY WAIVE ALL MORAL RIGHTS, ANY REQUIREMENT OF ATTRIBUTION, AND ALL
                        RIGHTS PROTECTING THE EXTRACTION, DISSEMINATION, USE AND REUSE OF DATA
                        PERTAINING TO USER CONTENT FOR ALL SUCH LICENSED USER CONTENT.
                    </p>
                    <p>
                        YOU HEREBY LICENSE ALL LICENSED USER CONTENT TO US TO THE GREATEST EXTENT
                        PERMITTED BY, BUT NOT IN CONTRAVENTION OF, APPLICABLE LAW, AND FULLY,
                        PERMANENTLY, IRREVOCABLY AND UNCONDITIONALLY WAIVE, ABANDON, AND SURRENDERS
                        ALL YOUR COPYRIGHT AND RELATED RIGHTS AND ASSOCIATED CLAIMS AND CAUSES OF
                        ACTION, WHETHER NOW KNOWN OR UNKNOWN (INCLUDING EXISTING AS WELL AS FUTURE
                        CLAIMS AND CAUSES OF ACTION), IN THE WORK (I) IN ALL TERRITORIES WORLDWIDE,
                        (II) FOR THE MAXIMUM DURATION PROVIDED BY APPLICABLE LAW OR TREATY
                        (INCLUDING FUTURE TIME EXTENSIONS), (III) IN ANY CURRENT OR FUTURE MEDIUM
                        AND FOR ANY NUMBER OF COPIES, AND (IV) FOR ANY PURPOSE WHATSOEVER, INCLUDING
                        WITHOUT LIMITATION COMMERCIAL, ADVERTISING OR PROMOTIONAL PURPOSES.
                    </p>
                    <p>
                        YOU HEREBY GRANT ALL LICENSED USER CONTENT TO US "AS IS", WITHOUT WARRANTY
                        OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
                        OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
                        NO EVENT SHALL YOU BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
                        WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
                        IN CONNECTION WITH THE LICENSED USER CONTENT OR THE USE OR OTHER DEALINGS IN
                        THE LICENSED USER CONTENT.
                    </p>
                    <p>
                        We reserve the right to not make Licensed User Content available that we
                        believe or suspect may contain malicious code or violate our Acceptable Use
                        or Privacy Policy.
                    </p>
                    <p>
                        These terms apply to all Licensed User Content unless You have written
                        agreement with Us stating otherwise. Any agreement in writing between You
                        and Us that has different licensing terms or stipulations shall supersede
                        this Article 4.
                    </p>
                    <p>
                        As stated above, by agreeing to these Terms of Service You also agree to be
                        bound by the terms and conditions of the Acceptable Use Policy incorporated
                        herein, and hereby acknowledge and agree that any and all User Content You
                        provide to the Services is governed by the Acceptable Use Policy.
                    </p>
                    <p>
                        If You do not agree to this Article 4 or wish or to reserve the right to
                        create Your own intellectual property, trademarks, or file patents please
                        review Article 9 of this agreement and You must contact Us accordingly
                        within thirty (30) calendar days.
                    </p>
                    <p>
                        WE DO NOT SHARE OR SELL YOUR DATA OR LICENSED USER CONTENT INCLUDING
                        ANONYMOUS DATA OR USER CONTENT.
                    </p>
                    <p>
                        We delete all User Content from Our system that is not published (as
                        described below) at set intervals. If You would like to withhold Your future
                        Licensed User Content or establish a separate relationship with Us please
                        email Us at
                        <a href="mailto:hello@casualsimulation.org">hello@casualsimulation.org</a>.
                    </p>
                    <p>PLEASE NOTE!</p>
                    <p>
                        WE DELETE ALL USER CONTENT EVERY 24 HOURS AT APPROXIMATELY 3 AM EASTERN
                        STANDARD TIME.
                    </p>
                    <p>
                        WE DELETE ALL USER CONTENT CREATED VIA UNIVERSALLY UNIQUE AUX BUNDLES EVERY
                        SUNDAY AT 3 AM EASTERN STANDARD TIME.
                    </p>
                    <p>
                        Publishing Licensed User Content is intended for personal use only unless
                        You have a separate written agreement with Us. We reserve the right to limit
                        or suspend any excessive use of publishing User Content (defined at Our sole
                        discretion) that impedes Our ability to provide the Services to as wide an
                        audience as possible or increases Our costs beyond what We can presently
                        support or sustain.
                    </p>
                    <p>
                        For more information on Your data and Licensed User Content please review
                        Our Privacy Policy.
                    </p>
                    <p>
                        You must comply with the laws that apply to You in the location that You
                        access Our Services from. IF THE LAWS APPLICABLE TO YOU RESTRICT OR PROHIBIT
                        YOU FROM ACCESSING OUR SERVICES, YOU MUST COMPLY WITH THOSE LEGAL
                        RESTRICTIONS OR, IF APPLICABLE, STOP ACCESSING OUR SERVICES.
                    </p>
                    <p>
                        You agree not to upload, communicate, transmit, or otherwise make available
                        any User Content:
                    </p>
                    <ul>
                        <li>
                            that is or could reasonably be viewed as unlawful, harmful, harassing,
                            defamatory, libelous, obscene or otherwise objectionable;
                        </li>
                        <li>
                            that is or could reasonably be viewed as invasive of another's privacy;
                        </li>
                        <li>
                            which You do not have a right to make available lawfully (such as inside
                            information, information which belongs to someone else, confidential
                            information, or anything that is copyrighted or trademarked);
                        </li>
                        <li>
                            which infringes any intellectual property right or other proprietary
                            right of Us or any other third party; or
                        </li>
                        <li>
                            which contains software viruses or any other computer code, files, data,
                            or programs designed to interrupt, destroy, or limit the functionality
                            of Our Services, anyone accessing the Services, or any computer
                            software, hardware, or telecommunications equipment.
                        </li>
                    </ul>
                    <p>You agree that You will not:</p>
                    <ul>
                        <li>
                            remove, amend or modify any proprietary notices or other ownership
                            information from Our Services;
                        </li>
                        <li>
                            interfere with or disrupt Our Services, servers or networks that support
                            or provide Our Services;
                        </li>
                        <li>
                            attempt to defeat or overcome any of Our encryption technologies or
                            security measures or data transmitted, processed or stored by Us;
                        </li>
                        <li>
                            collect any information about or regarding other people that use Our
                            Services, including, but not limited to any personal data or analytical
                            information;
                        </li>
                        <li>
                            use Our Services in violation of any applicable law or regulation; or
                        </li>
                        <li>
                            use Our Services in any other way not permitted by these Terms of
                            Service, Our Acceptable Use Policy, or Our Privacy Policy.
                        </li>
                    </ul>
                    <h3 id="Your-risk-in-accessing-user-content">
                        <ol start="5">
                            <li>Your Risk In Accessing Licensed User Content</li>
                        </ol>
                    </h3>
                    <p>
                        ANY USER CONTENT OR LICENSED USER CONTENT YOU ACCESS IS AT YOUR OWN RISK. WE
                        DO NOT HAVE THE CAPABILITY TO TEST OR INSPECT ALL STORE PUBLISHED LICENSED
                        USER CONTENT AND WE LICENSED USER CONTENT IN AUX BUNDLES “AS IS.” YOU
                        ACKNOWLEDGE THAT ACCESSING LICENSED USER CONTENT THAT CONTAINS MALWARE OR
                        OTHER MALICIOUS CODE IS POSSIBLE AND INHERENTLY RISKY. YOU SHOULD ONLY
                        ACCESS LICENSED USER CONTENT CREATED BY SOURCES YOU TRUST AND SHOULD PROCEED
                        WITH EXTREME CAUTION.
                    </p>
                    <h3 id="olx-services">
                        <ol start="6">
                            <li>OLX Services</li>
                        </ol>
                    </h3>
                    <p>
                        The terms in this Article apply to paid or unpaid practice work offered by
                        Casual Simulation or an OLX Partner (defined and listed below) who has
                        already agreed to the terms in this Article (“OLX Services”).
                    </p>
                    <p>
                        At times Casual Simulation may offer unpaid or paid practice work directly
                        or through one of Casual Simulation's approved partners (“OLX Partners”).
                    </p>
                    <p>Current list of approved OLX Partners:</p>
                    <ul>
                        <li>
                            Euzen Connect (<a href="https://www.euzenconnect.ai/"
                                >https://www.euzenconnect.ai/</a
                            >)
                        </li>
                    </ul>
                    <p>
                        If You are below the age of 18 or are outside of the United States You may
                        not use the OLX Services.
                    </p>
                    <p>
                        Any unpaid practice work You agree to undertake shall not be compensated and
                        shall be designated as such in advance. The remaining terms of this
                        Agreement shall still be binding. All paid work You agree to undertake shall
                        be paid at the then-current market rate set by the request of an approved
                        provider of OLX Services (including Us).
                    </p>
                    <p>
                        If You desire to pay sponsor or pay to have OLX Services work performed You
                        shall pay, in advance, Casual Simulation at the then-current market rate to
                        facilitate paying a worker to create an iteration of software development in
                        the form of a single version release in attempts fulfill all or only a
                        portion of Your request (called a “Collab”). All paid Collab purchases are
                        non-refundable and shall be paid in full before work is performed. YOU
                        ACKNOWLEDGE AND AGREE YOU ARE PAYING FOR AN ATTEMPTED SOLUTION WHICH MAY OR
                        MAY NOT BE FULLY OR EVEN PARTLY FUNCTIONAL, COMPLETE, OR ON PAR WITH
                        PROFESSIONAL WORKMANSHIP. EACH COLLAB CREATED AT YOUR REQUEST SHALL BE MADE
                        AVAILABLE “AS IS” AND YOU ASSUME ALL RISKS ASSOCIATED IN UTILIZING SUCH A
                        COLLAB. Again, You acknowledge that a Collab may be incomplete,
                        non-functional, in whole or part, as relates to Your desires and requests as
                        a Collab is an iteration only, not a complete project or work. You
                        understand and agree to the limitations of such a process and understand
                        that You must purchase more non-refundable Collabs until either You are
                        satisfied or You no longer wish to proceed. In no event will Your purchases
                        be refundable for You acknowledge that You have paid for a Collaber to
                        iterate on Your problem not to solve it.
                    </p>
                    <p>
                        EXCEPT AS EXPRESSLY PROVIDED IN THIS ARTICLE, CASUAL SIMULATION MAKES NO
                        REPRESENTATION OR WARRANTY AS REGARDS THE OLX SERVICES, EXPRESS OR IMPLIED,
                        EITHER IN FACT OR BY OPERATION OF LAW, STATUTE, OR OTHERWISE, AND CASUAL
                        SIMULATION SPECIFICALLY DISCLAIMS ANY AND ALL IMPLIED OR STATUTORY
                        WARRANTIES INCLUDING WARRANTIES OF MERCHANTABILITY AND OF FITNESS FOR A
                        PARTICULAR PURPOSE. FURTHER, EXCEPT AS EXPRESSLY SET FORTH IN THIS
                        AGREEMENT, NEITHER PARTY MAKES ANY REPRESENTATION OR WARRANTY UNDER THIS
                        AGREEMENT, EXPRESS OR IMPLIED, EITHER IN FACT OR BY OPERATION OF LAW,
                        STATUTE, OR OTHERWISE, AND EACH PARTY SPECIFICALLY DISCLAIMS ANY AND ALL
                        IMPLIED OR STATUTORY WARRANTIES INCLUDING WARRANTIES OF MERCHANTABILITY AND
                        OF FITNESS FOR A PARTICULAR PURPOSE.
                    </p>
                    <p>
                        The Parties agree no indemnification is provided by these Terms and agree to
                        bear their respective liability for any acts or omissions resulting under
                        these Terms of Service as the same shall be determined under the laws of the
                        state of Michigan or any mutually approved settlement of these Terms of
                        Service.
                    </p>
                    <p>
                        All development work for OLX Services shall be performed using CasualOS (<a
                            href="https://github.com/casual-simulation/casualos"
                            >https://github.com/casual-simulation/casualos</a
                        >) in whole or part and shall be considered work for hire donated to and
                        fully owned by Casual Simulation Inc. (a 501(c)(3) nonprofit). You agree all
                        work will be original and not infringe on any patent, copyright or other
                        proprietary right of any third person. We make all such work through the OLX
                        Services publicly available for commercial or noncommercial use under a MIT
                        License that allows the general public (including You) to use all Collabs or
                        other work product created without any restriction other than described in
                        the MIT License (<a href="https://opensource.org/licenses/MIT"
                            >https://opensource.org/licenses/MIT</a
                        >). To clarify, this allows everyone to use the work You create with the aim
                        of creating greater opportunities for all of humanity.
                    </p>
                    <p>
                        You waive all moral rights to such work and irrevocably grant such rights to
                        Casual Simulation Inc. to the fullest extent provided by law. Nonetheless,
                        We grant You an irrevocable, non-exclusive right to discuss or otherwise
                        create content describing Your involvement in the creation of such work. You
                        agree to these OLX Terms and understand that any other arrangement must be
                        separately negotiated and agreed upon by all Parties in writing.
                    </p>
                    <p>
                        As regards liability, in no event shall a Parties' liability exceed the fees
                        accepted by a Party in performance of the OLX Services.
                    </p>
                    <p>
                        If You access or use OLX Services You are responsible for the internet
                        connection and/or mobile charges that You may incur. You should ask Your
                        mobile operator if You are unsure what these charges will be before You
                        access OLX Services.
                    </p>
                    <p>
                        We make no claims that any content created may be lawfully viewed or
                        downloaded outside of the United States. Access to OLX Services may not be
                        legal by certain persons or in certain countries. If You access the OLX
                        Services from outside of the United States, You do so at Your own risk and
                        are responsible for compliance with the laws of Your jurisdiction. These
                        Terms of Service are void where prohibited by law, and the right to access
                        the OLX Services is revoked in such jurisdictions.
                    </p>
                    <p>
                        You may not “scrape” the website or OLX Services without Our written
                        permission.
                    </p>
                    <p>
                        While We try to ensure that the information regarding OLX Services is
                        complete and accurate, We do not warrant the accuracy and/or completeness of
                        any information for OLX Services nor do We guarantee availability of OLX
                        Services. We also make no commitment to keep the information on Our OLX
                        Services up to date. The material regarding OLX Services is provided “as is”
                        without any conditions, representations, warranties or other terms of any
                        kind. Under no circumstances will We be liable in any way for any
                        information pertaining to OLX Services, including, but not limited to, the
                        OLX Services being unavailable, any errors or omissions in any information,
                        or any losses or harm of any kind resulting from the use of any information
                        made available via OLX Services.
                    </p>
                    <p>
                        We have the right to withdraw or modify OLX Services (in whole or in part)
                        without notice and without liability to You from time to time:
                    </p>
                    <ul>
                        <li>
                            for technical reasons (such as technical difficulties experienced by Us
                            or on the internet);
                        </li>
                        <li>to allow Us to improve the experience;</li>
                        <li>
                            where We have legal reasons for doing so (including privacy or other
                            legal objections to the content or conduct of OLX Services);
                        </li>
                        <li>
                            because it no longer makes business sense for Us to provide a relevant
                            part of OLX Services; or
                        </li>
                        <li>because We have altered the OLX Services We provide.</li>
                    </ul>
                    <p>
                        There may also be times when OLX Services or any part of it is not available
                        for technical or maintenance related reasons, whether on a scheduled or
                        unscheduled basis.
                    </p>
                    <h3 id="warranty-disclaimer">
                        <ol start="7">
                            <li>Warranty Disclaimer</li>
                        </ol>
                    </h3>
                    <p>
                        THE SERVICES AND THE CONTENT ON THE SERVICES THAT IS MADE AVAILABLE TO YOU
                        ARE PROVIDED ON AN “AS IS” AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF
                        ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING, WITHOUT LIMITATION, IMPLIED
                        WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE OR
                        NON-INFRINGEMENT. WE DO NOT WARRANT OR MAKE ANY REPRESENTATIONS REGARDING
                        THE AVAILABILITY, USE, TIMELINESS, SECURITY, VALIDITY, ACCURACY, OR
                        RELIABILITY OF, OR THE RESULTS OF THE USE OF, OR OTHERWISE RESPECTING, THE
                        SERVICES. ANY MATERIAL, CONTENT, OR USER CONTENT, OR LICENSED USER CONTENT
                        DOWNLOADED OR OTHERWISE OBTAINED THROUGH THE USE OF THE SERVICES IS DONE AT
                        YOUR OWN DISCRETION AND RISK AND YOU ARE SOLELY RESPONSIBLE FOR ANY DAMAGE
                        TO YOUR COMPUTER SYSTEM OR LOSS OF DATA THAT RESULTS FROM THE DOWNLOAD OF
                        ANY SUCH MATERIAL, OR USE OF THE SERVICES INCLUDING ANY LEGAL LIABILITY YOU
                        MAY ASSUME BY CREATING, DOWNLOADING, OR OTHERWISE INTERACTING WITH USER
                        CONTENT OR LICENSED USER CONTENT TO THE FULLEST EXTENT BY LAW. SOME
                        JURISDICTIONS DO NOT ALLOW THE EXCLUSIONS OR LIMITATIONS ON HOW LONG AN
                        IMPLIED WARRANTY LASTS, SO THE ABOVE LIMITATIONS OR EXCLUSIONS MAY NOT
                        APPLY. NO ADVICE OR INFORMATION, WHETHER ORAL OR WRITTEN, OBTAINED BY YOU
                        FROM US SHALL BE DEEMED TO ALTER THIS DISCLAIMER OF WARRANTY, OR TO CREATE
                        ANY WARRANTY.
                    </p>
                    <h3 id="limitation-of-liability">
                        <ol start="8">
                            <li>Limitation of Liability</li>
                        </ol>
                    </h3>
                    <p>
                        IN NO EVENT SHALL WE, OUR OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS, BE
                        LIABLE TO YOU FOR ANY (I) INDIRECT, INCIDENTAL, SPECIAL, PUNITIVE, OR
                        CONSEQUENTIAL DAMAGES WHATSOEVER RESULTING FROM ANY (A) ERRORS, MISTAKES, OR
                        INACCURACIES OF CONTENT, (B) PERSONAL INJURY OR PROPERTY DAMAGE, OF ANY
                        NATURE WHATSOEVER, RESULTING FROM YOUR ACCESS TO AND USE OF OUR SERVICES;
                        (II) UNAUTHORIZED ACCESS TO OR USE OF OUR SECURE SERVERS AND/OR ANY AND ALL
                        PERSONAL INFORMATION AND/OR FINANCIAL INFORMATION STORED THEREIN, (III)
                        INTERRUPTION OR CESSATION OF TRANSMISSION TO OR FROM OUR SERVICES, (IV)
                        BUGS, VIRUSES, TROJAN HORSES, OR THE LIKE, WHICH MAY BE TRANSMITTED TO OR
                        THROUGH OUR SERVICES BY ANY THIRD PARTY, (V) ERRORS OR OMISSIONS IN ANY
                        CONTENT OR FOR ANY LOSS OR DAMAGE OF ANY KIND INCURRED AS A RESULT OF YOUR
                        USE OF ANY CONTENT POSTED, EMAILED, TRANSMITTED, OR OTHERWISE MADE AVAILABLE
                        VIA THE SERVICES, WHETHER BASED ON WARRANTY, CONTRACT, TORT, OR ANY OTHER
                        LEGAL THEORY, OR (VI) DIRECT DAMAGES IN EXCESS OF $100; WHETHER OR NOT WE
                        ARE ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. SOME STATES DO NOT ALLOW THE
                        EXCLUSION OR LIMITATION OF INCIDENTAL OR CONSEQUENTIAL DAMAGES; THE
                        FOREGOING LIMITATION OF LIABILITY SHALL APPLY TO THE FULLEST EXTENT
                        PERMITTED BY LAW IN THE APPLICABLE JURISDICTION.
                    </p>
                    <h3 id="indemnity">
                        <ol start="9">
                            <li>Indemnity</li>
                        </ol>
                    </h3>
                    <p>
                        You agree to defend, indemnify, and hold harmless Us, Our officers,
                        directors, employees, agents, affiliates, parents and subsidiaries from and
                        against any and all claims, damages, obligations, losses, liabilities, costs
                        or debt, and expenses (including but not limited to attorney&rsquo;s fees)
                        arising from: (i) Your use of and access to the Services; or (ii) Your
                        violation of any term of these Terms of Service. This defense and
                        indemnification obligation will survive these Terms of Service and Your use
                        of the Services. For clarification, You agree to compensate Us, according to
                        law, for all losses, harm, claims and expenses that may arise from any
                        breach of these terms by You.
                    </p>
                    <h3 id="intellectual-property">
                        <ol start="10">
                            <li>Intellectual Property</li>
                        </ol>
                    </h3>
                    <p>
                        EXCEPT AS PERTAINING TO LICENSED USER CONTENT, YOU ACKNOWLEDGE THAT ALL
                        COPYRIGHT, TRADEMARKS, AND OTHER INTELLECTUAL PROPERTY RIGHTS IN AND
                        RELATING TO OUR SERVICES ARE OWNED BY OR LICENSED TO US UNLESS YOU HAVE A
                        SEPARATE AGREEMENT WITH US IN WRITING STATING OTHERWISE. YOU SHALL NOT TAKE
                        ANY ACTION TO JEOPARDIZE, LIMIT, OR INTERFERE WITH ANY OF OUR INTELLECTUAL
                        PROPERTY RIGHTS NOW OR IN THE FUTURE, INCLUDING WITHOUT LIMITATION
                        TRADEMARKING, PATENTING, OR CREATING ANY WORK OR INTELLECTUAL PROPERTY THAT
                        WOULD PRECLUDE US OR OTHERS FROM FULLY UTILIZING THE SERVICES. BY USING THE
                        SERVICES YOU ACKNOWLEDGE AND AGREE THESE TERMS.
                    </p>
                    <p>
                        IF YOU DO NOT AGREE TO THESE TERMS YOU MUST CONTACT US IN WRITING WITH
                        THIRTY (30) CALENDAR DAYS OF USING THE SERVICES AT
                        <a href="mailto:hello@casualsimulation.org">hello@casualsimulation.org</a>.
                    </p>
                    <p>
                        While You are in compliance with these terms, Our Acceptable Use Policy, and
                        Our Privacy Policy, We grant You a non-exclusive, non-transferable,
                        personal, revocable limited license to access and use Our Services, in each
                        case provided that such use is in accordance with these terms. You agree not
                        to use Our Services, or any elements thereof, for anything else.
                    </p>
                    <p>
                        We appreciate Your feedback and suggestions. Our goal is to provide high
                        quality products and services. Our ability to freely evaluate and, if
                        appropriate, implement ideas and information improves the online experience
                        for all users. Therefore, any information, feedback, data, questions,
                        comments, suggestions, or any other material or proposals, submitted to Us,
                        whether solicited or unsolicited, regarding its services or web site shall
                        be deemed non-confidential unless mutually agreed between Us and You in
                        writing. By providing any such material, You hereby grant Us an
                        unrestricted, irrevocable, royalty-free and perpetual right to freely,
                        reproduce, use, disclose, modify, perform, publish, translate, create
                        derivative works from, distribute and display any such information You send
                        Us, without limitation, for any and all commercial and non-commercial
                        purposes. We are free to use any ideas, concepts or techniques contained in
                        this response for any purpose whatsoever including, but not limited to,
                        developing, manufacturing, and marketing products incorporating such ideas,
                        concepts or techniques.
                    </p>
                    <h3 id="privacy">
                        <ol start="11">
                            <li>Privacy</li>
                        </ol>
                    </h3>
                    <p>
                        We will only collect, process, use, and share Your personal information in
                        accordance with Our Privacy Policy and as set out in these Terms of Service.
                        IF YOU DO NOT AGREE TO OUR PRIVACY POLICY, YOU SHOULD NOT CONTINUE TO ACCESS
                        OUR SERVICES.
                    </p>
                    <p>
                        We may use cookies to store certain types of information each time You use
                        Our Services. They may for example be used to help Us recognize what kind of
                        device You are using. You can find out more about how We use cookies by
                        reading Our Privacy Policy.
                    </p>
                    <h3 id="mandatory-arbitration">
                        <ol start="12">
                            <li>
                                <h4>Mandatory Arbitration</h4>
                            </li>
                        </ol>
                    </h3>
                    <p>
                        YOU AGREE THAT WITH RESPECT TO ALL DISPUTES BETWEEN YOU AND US OR OUR
                        AFFILIATES, OFFICERS, DIRECTORS, OR EMPLOYEES (WHETHER OR NOT SUCH DISPUTE
                        INVOLVES A THIRD PARTY) WITH REGARD TO YOUR RELATIONSHIP WITH US, INCLUDING
                        WITHOUT LIMITATION DISPUTES RELATING TO THESE TERMS OF SERVICE, YOUR USE OF
                        THE SERVICES, AND/OR RIGHTS OF PRIVACY AND/OR PUBLICITY, YOU AND US SHALL
                        FIRST CONSULT WITH EACH OTHER TO ATTEMPT TO RESOLVE SUCH DISPUTE IN A MANNER
                        SATISFACTORY TO BOTH PARTIES, AND THAT IF A RESOLUTION IS NOT REACHED WITHIN
                        ONE HUNDRED EIGHTY (180) DAYS, THEN THE DISPUTE SHALL BE REFERRED TO AND
                        RESOLVED BY BINDING ARBITRATION UNDER JAMS, INC.&rsquo;S RULES FOR
                        ARBITRATION OF CONSUMER-RELATED DISPUTES AND YOU AND WE HEREBY EXPRESSLY
                        WAIVE TRIAL BY JURY; PROVIDED, HOWEVER, THAT TO THE EXTENT THAT YOU HAVE IN
                        ANY MANNER VIOLATED OR THREATENED TO VIOLATE OUR INTELLECTUAL PROPERTY
                        RIGHTS, WE MAY SEEK INJUNCTIVE OR OTHER APPROPRIATE RELIEF IN ANY STATE OR
                        FEDERAL COURT IN THE STATE OF MICHIGAN. DISCOVERY AND RIGHTS TO APPEAL IN
                        ARBITRATION ARE GENERALLY MORE LIMITED THAN IN A LAWSUIT, AND OTHER RIGHTS
                        THAT YOU AND WE WOULD HAVE IN COURT MAY NOT BE AVAILABLE IN ARBITRATION.
                    </p>
                    <p>
                        As an alternative, You may bring Your claim in Your local "small claims"
                        court, if permitted by that small claims court&rsquo;s rules and if within
                        such court&rsquo;s jurisdiction, unless such action is transferred, removed,
                        or appealed to a different court. You may bring claims only on Your own
                        behalf. Neither You nor We will participate in a class action or class-wide
                        arbitration for any claims covered by this agreement to arbitrate.
                    </p>
                    <p>
                        YOU ARE GIVING UP YOUR RIGHT TO PARTICIPATE AS A CLASS REPRESENTATIVE OR
                        CLASS MEMBER ON ANY CLASS CLAIM YOU MAY HAVE AGAINST US INCLUDING ANY RIGHT
                        TO CLASS ARBITRATION OR ANY CONSOLIDATION OF INDIVIDUAL ARBITRATIONS.
                    </p>
                    <p>
                        You also agree not to participate in claims brought in a private or
                        representative capacity, or consolidated claims involving another
                        person&rsquo;s account, if We are a party to the proceeding. This dispute
                        resolution provision will be governed by the Federal Arbitration Act and not
                        by any state law concerning arbitration. In the event JAMS, INC. is
                        unwilling or unable to set a hearing date within one hundred and sixty (160)
                        days of filing the case, then either We or You can elect to have the
                        arbitration administered instead by the American Arbitration Association.
                        Judgment on the award rendered by the arbitrator may be entered in any court
                        having competent jurisdiction. Any provision of applicable law
                        notwithstanding, the arbitrator will not have authority to award damages,
                        remedies, or awards that conflict with these Terms of Service. You agree
                        that regardless of any statute or law to the contrary, any claim or cause of
                        action arising out of, related to or connected with the use of the Services
                        must be filed within one (1) year after such claim of action arose or be
                        forever banned.
                    </p>
                    <p>
                        You agree that, notwithstanding anything in the foregoing, any arbitration
                        proceeding between You and Us will be conducted in Kent County, Grand
                        Rapids, Michigan, and that the language of the arbitration shall be in
                        English, and that all arbitration proceedings shall be considered
                        confidential in nature.
                    </p>
                    <p>
                        If You don&rsquo;t want to be bound by the arbitration and class-action
                        waiver provisions in this section, You must notify Us in writing within
                        thirty (30) days of the date that You first accept these Terms of Service
                        (unless a longer period is required by applicable law), and then You must
                        litigate any disputes against Us in accordance with the "Assignment and
                        Jurisdiction" section below.
                    </p>
                    <p>
                        Your written notification must be mailed to Us at Casual Simulation Inc.,
                        Attn: Legal Department, 879 4 Mile RD NE, Grand Rapids, MI 49525 or by email
                        notification at
                        <a href="mailto:hello@casualsimulation.org">hello@casualsimulation.org</a>.
                        If You do not notify Us in accordance with this paragraph, You agree to be
                        bound by the terms of this section, including, without limitation, the
                        arbitration and class-action waiver provisions, and also including such
                        provisions in any modifications We make to these Terms of Service after the
                        date of Your first acceptance. Such notification must include: (i) Your
                        name; (ii) Your email address and mailing address; and (iii) a statement
                        that You do not wish to resolve disputes with Us through arbitration or
                        waive Your ability to participate in a class action. If We make any changes
                        to this section (other than a change to the address at which We will receive
                        notices or rejections of future changes to this section), You may reject any
                        such change by sending Us written notice, within thirty (30) days of the
                        change, to the address set out in the "Notices" section. It is not necessary
                        to send Us a rejection of a future change to this section if You had
                        properly opted out within the first thirty (30) days after You first
                        accepted the provisions in this section. If You have not properly opted out,
                        then by rejecting a future change, You are agreeing that You will arbitrate
                        any dispute between Us in accordance with the language of this section, as
                        modified by any changes You did not reject. A notification sent pursuant to
                        this paragraph solely affects these Terms of Service; if You previously
                        entered into other arbitration or dispute resolution agreements with Us or
                        enter into other such agreements in the future, Your notification that You
                        are opting out of the provisions in this section shall not affect the other
                        arbitration agreements between You and Us.
                    </p>
                    <h3 id="general-terms">
                        <ol start="12">
                            <li>General Terms</li>
                        </ol>
                    </h3>
                    <p>
                        If any part of these terms is held to be invalid or unenforceable under any
                        applicable local laws or by an applicable court, that part shall be
                        interpreted in a manner consistent with applicable law to reflect as nearly
                        as possible Our original intentions and the remainder of these terms shall
                        remain valid and enforceable.
                    </p>
                    <p>
                        Our failure to exercise or enforce any of Our rights under these terms does
                        not waive Our right to enforce such right. Any waiver of such rights shall
                        only be effective if it is in writing and signed by Us.
                    </p>
                    <p>
                        No agency, partnership, joint venture, or employment is created as a result
                        of these Terms of Service and You do not have any authority of any kind to
                        bind Us in any respect whatsoever.
                    </p>
                    <p>
                        The sections entitled "About These Terms", "Personal Use Only ", "About
                        Accessing And Using Our Services", "User Conduct and Content", "Your Breach
                        of These Terms", "Warranty Disclaimer ", "Limitation of Liability",
                        "Indemnity", "Intellectual Property", "Privacy", "Mandatory Arbitration",
                        and "General Terms" shall survive any termination or expiration of these
                        Terms of Service.
                    </p>
                    <p>
                        These Terms of Service shall be governed by the laws of the Kent County of
                        the State of Michigan, without respect to its conflict of laws principles.
                        Any claim or dispute between You and Us that arises in whole or in part from
                        the Site shall be decided exclusively by a court of competent jurisdiction
                        located in Kent County, Michigan. These Terms of Service, together with Our
                        Privacy Policy, constitute the entire agreement between You and Us
                        concerning Your access to and use of the Services.
                    </p> -->
                <!-- </div> -->
            </md-card-content>
        </md-card>
    </div>
</template>
<script src="./AuthTerms.ts"></script>
<style src="./AuthTerms.css" scoped></style>
