/**
 * Cyberdelic Convergence - Static Data
 * Separated from main logic for clarity.
 */
(function () {

    window.CyberdelicData = {
        // Domain nodes with their positions and colors
        domains: [
            {
                id: 'psychedelic',
                name: 'Psychedelic\nResearch',
                color: '#B49BF8',
                angle: 0
            },
            {
                id: 'vr-tech',
                name: 'VR/AR\nTechnology',
                color: '#4CDCEF',
                angle: 60
            },
            {
                id: 'neuroscience',
                name: 'Neuroscience',
                color: '#E562A4',
                angle: 120
            },
            {
                id: 'contemplative',
                name: 'Contemplative\nPractices',
                color: '#DDB049',
                angle: 180
            },
            {
                id: 'gaming',
                name: 'Gaming',
                color: '#5FDFA6',
                angle: 240
            },
            {
                id: 'digital-art',
                name: 'Digital Art',
                color: '#B964F5',
                angle: 300
            }
        ],

        // Connections with strength progression over years
        connections: [
            {
                source: 'psychedelic',
                target: 'neuroscience',
                yearAppears: 2016,
                strengthByYear: {
                    2016: 0.2, 2017: 0.3, 2018: 0.5, 2019: 0.6, 2020: 0.7,
                    2021: 0.8, 2022: 0.85, 2023: 0.9, 2024: 0.95, 2025: 1.0
                }
            },
            {
                source: 'vr-tech',
                target: 'gaming',
                yearAppears: 2016,
                strengthByYear: {
                    2016: 0.3, 2017: 0.4, 2018: 0.5, 2019: 0.6, 2020: 0.65,
                    2021: 0.7, 2022: 0.7, 2023: 0.7, 2024: 0.7, 2025: 0.7
                }
            },
            {
                source: 'vr-tech',
                target: 'contemplative',
                yearAppears: 2017,
                strengthByYear: {
                    2017: 0.2, 2018: 0.4, 2019: 0.6, 2020: 0.7, 2021: 0.8,
                    2022: 0.85, 2023: 0.9, 2024: 0.95, 2025: 1.0
                }
            },
            {
                source: 'neuroscience',
                target: 'contemplative',
                yearAppears: 2018,
                strengthByYear: {
                    2018: 0.3, 2019: 0.4, 2020: 0.5, 2021: 0.6, 2022: 0.65,
                    2023: 0.7, 2024: 0.75, 2025: 0.8
                }
            },
            {
                source: 'psychedelic',
                target: 'vr-tech',
                yearAppears: 2019,
                strengthByYear: {
                    2019: 0.3, 2020: 0.5, 2021: 0.7, 2022: 0.8, 2023: 0.9,
                    2024: 0.95, 2025: 1.0
                }
            },
            {
                source: 'vr-tech',
                target: 'neuroscience',
                yearAppears: 2019,
                strengthByYear: {
                    2019: 0.2, 2020: 0.4, 2021: 0.6, 2022: 0.7, 2023: 0.75,
                    2024: 0.8, 2025: 0.85
                }
            },
            {
                source: 'digital-art',
                target: 'vr-tech',
                yearAppears: 2018,
                strengthByYear: {
                    2018: 0.2, 2019: 0.3, 2020: 0.4, 2021: 0.5, 2022: 0.55,
                    2023: 0.6, 2024: 0.6, 2025: 0.6
                }
            },
            {
                source: 'contemplative',
                target: 'psychedelic',
                yearAppears: 2020,
                strengthByYear: {
                    2020: 0.3, 2021: 0.5, 2022: 0.7, 2023: 0.75, 2024: 0.8,
                    2025: 0.85
                }
            },
            {
                source: 'gaming',
                target: 'neuroscience',
                yearAppears: 2020,
                strengthByYear: {
                    2020: 0.2, 2021: 0.3, 2022: 0.4, 2023: 0.45, 2024: 0.5,
                    2025: 0.5
                }
            },
            {
                source: 'digital-art',
                target: 'contemplative',
                yearAppears: 2021,
                strengthByYear: {
                    2021: 0.2, 2022: 0.4, 2023: 0.5, 2024: 0.6, 2025: 0.7
                }
            },
            {
                source: 'gaming',
                target: 'contemplative',
                yearAppears: 2022,
                strengthByYear: {
                    2022: 0.2, 2023: 0.3, 2024: 0.5, 2025: 0.6
                }
            },
            {
                source: 'digital-art',
                target: 'psychedelic',
                yearAppears: 2021,
                strengthByYear: {
                    2021: 0.3, 2022: 0.4, 2023: 0.5, 2024: 0.6, 2025: 0.7
                }
            },
            {
                source: 'digital-art',
                target: 'gaming',
                yearAppears: 2017,
                strengthByYear: {
                    2017: 0.3, 2018: 0.4, 2019: 0.5, 2020: 0.6, 2021: 0.7,
                    2022: 0.75, 2023: 0.8, 2024: 0.85, 2025: 0.9
                }
            }
        ],

        // Detailed content for each domain
        domainDetails: {
            'psychedelic': {
                contentByYear: {
                    2015: {
                        contributions: [
                            'Clinical trial resurgence',
                            'MAPS Phase 2 studies',
                            'Set and setting revival',
                            'Academic legitimacy growing'
                        ],
                        keyPeople: [
                            { name: 'Dr. Rick Doblin', role: 'MAPS founder, clinical trials' },
                            { name: 'Dr. Roland Griffiths', role: 'Johns Hopkins psilocybin pioneer' }
                        ],
                        technologies: [
                            'Standardized dosing protocols',
                            'Clinical assessment tools',
                            'Therapy session structure'
                        ],
                        examples: [
                            { name: 'MAPS MDMA Phase 2', description: 'PTSD treatment trials', url: 'https://maps.org/mdma/ptsd/' },
                            { name: 'Johns Hopkins Studies', description: 'Psilocybin mystical experience', url: 'https://hopkinspsychedelic.org/' }
                        ]
                    },
                    2018: {
                        contributions: [
                            'FDA Breakthrough Therapy status',
                            'Psilocybin depression trials',
                            'Decriminalization movements begin',
                            'Integration therapy protocols'
                        ],
                        keyPeople: [
                            { name: 'Dr. Roland Griffiths', role: 'Johns Hopkins depression studies' },
                            { name: 'Dr. Robin Carhart-Harris', role: 'Imperial College brain imaging' },
                            { name: 'Dr. Rick Doblin', role: 'MAPS Phase 3 preparation' },
                            { name: 'Melissa Warner', role: 'Helped build the Psychedelic Research in Science and Medicine(PRISM) in Australia ' }
                        ],
                        technologies: [
                            'fMRI during psychedelic states',
                            'Integration therapy frameworks',
                            'Safety screening enhanced',
                            'Therapist training programs'
                        ],
                        examples: [
                            { name: 'Psilocybin Cancer Anxiety', description: 'End-of-life care breakthrough', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5367557/' },
                            { name: 'Imperial College Trials', description: 'Treatment-resistant depression', url: 'https://www.imperial.ac.uk/psychedelic-research-centre/' },
                            {
                                name: 'PRISM Therapeutic VR Program',
                                description: 'VR for psychedelic therapy prep',
                                url: 'https://www.prism.org.au/acid-test-how-psychedelic-virtual-reality-can-help-end-societys-mass-bad-trip/'
                            }
                        ]
                    },
                    2021: {
                        contributions: [
                            'MAPS Phase 3 MDMA completion',
                            'Oregon Measure 109 passes',
                            'Ketamine clinics proliferate',
                            'Psychedelic therapy training boom',
                            'Context engineering frameworks'
                        ],
                        keyPeople: [
                            { name: 'Dr. Rick Doblin', role: 'MAPS Phase 3 success' },
                            { name: 'Dr. Robin Carhart-Harris', role: 'UCSF research center' },
                            { name: 'Dr. Nolan Williams', role: 'Stanford psychedelics division' },
                            { name: 'Carl H. Smith', role: 'Cognitive Scientist' }
                        ],
                        technologies: [
                            'Therapist certification programs',
                            'Integration app platforms',
                            'Ketamine protocols refined',
                            'Group therapy models'
                        ],
                        examples: [
                            { name: 'Field Trip Health', description: 'Ketamine therapy clinics', url: 'https://www.fieldtriphealth.com/' },
                            { name: 'CIIS Training', description: 'Therapist certification program', url: 'https://www.ciis.edu/research-centers/center-for-psychedelic-therapies-and-research' },
                            { name: 'Numinus Wellness', description: 'Integrated psychedelic therapy', url: 'https://numinus.com/' },
                            {
                                name: 'Cyberdelics Context Engineering',
                                description: 'Smith & Warner framework',
                                url: 'https://www.scienceopen.com/hosted-document?doi=10.14236/ewic/EVA2022.48'
                            }
                        ]
                    },
                    2024: {
                        contributions: [
                            'FDA MDMA approval pathway',
                            'State legalization expansion',
                            'Insurance coverage discussions',
                            'At-home ketamine therapy',
                            'Psychedelic-assisted group work'
                        ],
                        keyPeople: [
                            { name: 'Dr. Rick Doblin', role: 'MAPS commercialization' },
                            { name: 'Dr. Rachel Yehuda', role: 'PTSD research integration' },
                            { name: 'Stanislav Grof', role: 'Holotropic breathwork elder' }
                        ],
                        technologies: [
                            'At-home ketamine programs',
                            'Virtual integration therapy',
                            'Measurement scales refined',
                            'Safety monitoring systems'
                        ],
                        examples: [
                            { name: 'Mindbloom', description: 'At-home ketamine therapy', url: 'https://www.mindbloom.com/' },
                            { name: 'MAPS Public Benefit Corp', description: 'MDMA therapy rollout', url: 'https://lykospbc.com/' },
                            { name: 'Beckley Retreats', description: 'Legal psilocybin experiences', url: 'https://www.beckleyretreats.com/' }
                        ]
                    }
                }
            },
            'vr-tech': {
                contentByYear: {
                    2015: {
                        contributions: [
                            'Basic HMD displays',
                            'External sensor tracking',
                            'Early motion controllers',
                            'Development kits available'
                        ],
                        keyPeople: [
                            { name: 'Palmer Luckey', role: 'Oculus Rift development' },
                            { name: 'Jaron Lanier', role: 'VR advocacy and vision' },
                            { name: 'Brendan Iribe', role: 'Oculus CEO' }
                        ],
                        technologies: [
                            'Oculus DK2 (development kit)',
                            'External camera tracking',
                            'Basic stereoscopic rendering',
                            'Positional tracking (3DOF)'
                        ],
                        examples: [
                            { name: 'Google Cardboard', description: 'Mobile VR accessibility', url: 'https://arvr.google.com/cardboard/' },
                            { name: 'Oculus DK2 Demos', description: 'Early VR experiences', url: 'https://www.meta.com/quest/' },
                            { name: 'VR meditation experiments', description: 'Early wellness tests', url: 'https://www.tripp.com/blog/the-science-behind-tripp' }
                        ]
                    },
                    2016: {
                        contributions: [
                            'Consumer VR headsets launch',
                            'Room-scale tracking',
                            'Motion controller standards',
                            'VR content ecosystem begins'
                        ],
                        keyPeople: [
                            { name: 'Palmer Luckey', role: 'Oculus Rift CV1 launch' },
                            { name: 'Gabe Newell', role: 'HTC Vive partnership' },
                            { name: 'Brendan Iribe', role: 'Oculus ecosystem growth' }
                        ],
                        technologies: [
                            'Oculus Rift CV1',
                            'HTC Vive with Lighthouse',
                            'Touch controllers',
                            'Room-scale VR (6DOF)',
                            'SteamVR platform'
                        ],
                        examples: [
                            { name: 'The Lab', description: 'Valve VR showcase', url: 'https://store.steampowered.com/app/450390/The_Lab/' },
                            { name: 'Job Simulator', description: 'Popular launch title', url: 'https://jobsimulatorgame.com/' },
                            { name: 'Guided Meditation VR', description: 'Early wellness VR', url: 'https://guidedmeditationvr.com/' }
                        ]
                    },
                    2019: {
                        contributions: [
                            'Inside-out tracking adoption',
                            'Standalone VR headsets',
                            'Hand tracking development',
                            'Social VR platforms',
                            'Wireless VR solutions'
                        ],
                        keyPeople: [
                            { name: 'Mark Zuckerberg', role: 'Facebook VR investment' },
                            { name: 'John Carmack', role: 'Oculus CTO, Quest focus' },
                            { name: 'Hugo Barra', role: 'Oculus VP of VR' }
                        ],
                        technologies: [
                            'Oculus Quest (standalone)',
                            'Inside-out tracking',
                            'Hand tracking (experimental)',
                            '6DOF wireless VR',
                            'XR2 mobile processors'
                        ],
                        examples: [
                            { name: 'Beat Saber', description: 'VR rhythm phenomenon', url: 'https://beatsaber.com/' },
                            { name: 'VRChat', description: 'Social VR platform', url: 'https://hello.vrchat.com/' },
                            { name: 'Guided Meditation VR', description: 'Wellness apps grow', url: 'https://guidedmeditationvr.com/' },
                            { name: 'Nature Treks VR', description: 'Relaxation environments', url: 'https://store.steampowered.com/app/587580/Nature_Treks_VR/' }
                        ]
                    },
                    2022: {
                        contributions: [
                            'High-resolution displays',
                            'Eye tracking integration',
                            'Mixed reality passthrough',
                            'Haptic feedback vests',
                            'Wireless streaming refined'
                        ],
                        keyPeople: [
                            { name: 'Mark Zuckerberg', role: 'Meta rebranding, metaverse' },
                            { name: 'John Carmack', role: 'Quest optimization' },
                            { name: 'Andrew Bosworth', role: 'Meta Reality Labs lead' }
                        ],
                        technologies: [
                            'Meta Quest 2 (mass adoption)',
                            'Eye tracking sensors',
                            'Color passthrough AR',
                            'Pancake lens optics',
                            'Cloud rendering streaming'
                        ],
                        examples: [
                            { name: 'TRIPP', description: 'Therapeutic VR standard', url: 'https://www.tripp.com/' },
                            { name: 'Supernatural', description: 'VR fitness with meditation', url: 'https://www.getsupernatural.com/' },
                            { name: 'Immersed', description: 'VR workplace', url: 'https://immersed.com/' }
                        ]
                    }
                }
            },
            'neuroscience': {
                contentByYear: {
                    2015: {
                        contributions: [
                            'fMRI meditation studies',
                            'Default Mode Network mapping',
                            'Neuroplasticity evidence',
                            'Early EEG headbands'
                        ],
                        keyPeople: [
                            { name: 'Dr. Richard Davidson', role: 'Meditation neuroscience pioneer' },
                            { name: 'Dr. Judson Brewer', role: 'Mindfulness brain studies' }
                        ],
                        technologies: [
                            'fMRI meditation scans',
                            'Consumer EEG devices (Muse)',
                            'Basic neurofeedback protocols',
                            'Brain network analysis'
                        ],
                        examples: [
                            { name: 'Muse Headband', description: 'Consumer meditation EEG', url: 'https://choosemuse.com/' },
                            { name: 'fMRI Meditation Studies', description: 'Academic research', url: 'https://pubmed.ncbi.nlm.nih.gov/' }
                        ]
                    },
                    2018: {
                        contributions: [
                            'Real-time fMRI neurofeedback',
                            'Psychedelic brain imaging',
                            'DMN dissolution studies',
                            'Consciousness theories advance',
                            'Consumer neurofeedback grows'
                        ],
                        keyPeople: [
                            { name: 'Dr. Robin Carhart-Harris', role: 'Psychedelic brain imaging' },
                            { name: 'Dr. Anil Seth', role: 'Consciousness theories' },
                            { name: 'Dr. Andrew Huberman', role: 'Vision and states research' }
                        ],
                        technologies: [
                            'Real-time fMRI feedback',
                            'High-density EEG arrays',
                            'Connectivity analysis tools',
                            'Mobile EEG devices',
                            'Neurofeedback apps'
                        ],
                        examples: [
                            { name: 'Imperial College Studies', description: 'Psilocybin brain imaging', url: 'https://www.imperial.ac.uk/psychedelic-research-centre/' },
                            { name: 'Muse 2', description: 'Advanced meditation EEG', url: 'https://choosemuse.com/products/muse-2' },
                            { name: 'BrainCo Focus', description: 'Attention training device', url: 'https://www.brainco.tech/' }
                        ]
                    },
                    2021: {
                        contributions: [
                            'AI-enhanced brain analysis',
                            'VR brain state monitoring',
                            'Portable fMRI development',
                            'Consciousness measurement scales',
                            'Psychedelic neuroscience boom'
                        ],
                        keyPeople: [
                            { name: 'Dr. Andrew Huberman', role: 'Huberman Lab podcast influence' },
                            { name: 'Dr. Karl Friston', role: 'Predictive processing models' },
                            { name: 'Dr. Matthew Walker', role: 'Sleep and consciousness' }
                        ],
                        technologies: [
                            'AI brain state classification',
                            'Real-time EEG + VR',
                            'Portable neuroimaging',
                            'Machine learning analysis',
                            'Brain connectivity maps'
                        ],
                        examples: [
                            { name: 'Kernel Flow', description: 'Portable brain imaging', url: 'https://www.kernel.com/' },
                            { name: 'TRIPP + EEG', description: 'VR with neurofeedback', url: 'https://www.neuroregulation.org/article/view/23484' },
                            { name: 'Neurosity Crown', description: 'BCI meditation device', url: 'https://neurosity.co/' },
                        ]
                    },
                    2024: {
                        contributions: [
                            'Consumer BCIs mainstream',
                            'VR neurofeedback standard',
                            'Consciousness AI models',
                            'Psychedelic brain maps',
                            'Real-time state optimization'
                        ],
                        keyPeople: [
                            { name: 'Dr. Andrew Huberman', role: 'Science communication leader' },
                            { name: 'Dr. Anil Seth', role: 'Consciousness framework influence' },
                            { name: 'Dr. Nolan Williams', role: 'Stanford brain stimulation' }
                        ],
                        technologies: [
                            'Consumer BCI headsets',
                            'VR + real-time neuroSfeedback',
                            'AI consciousness models',
                            'Ultrasound brain stimulation',
                            'Closed-loop brain systems'
                        ],
                        examples: [
                            { name: 'Neurable Headphones', description: 'BCI in everyday devices', url: 'https://neurable.com/' },
                            { name: 'TRIPP Neurofeedback', description: 'Standard VR wellness', url: 'https://www.neuroregulation.org/article/view/23484' },
                            { name: 'Omnifit Brain', description: 'AI-guided brain training', url: 'https://www.omnifit.co.kr/en/omnifit_brain' }
                        ]
                    }
                }
            },
            'contemplative': {
                contentByYear: {
                    2015: {
                        contributions: [
                            'Mindfulness apps proliferate',
                            'MBSR in healthcare',
                            'Corporate meditation programs',
                            'Secular Buddhism growth'
                        ],
                        keyPeople: [
                            { name: 'Jon Kabat-Zinn', role: 'MBSR mainstream acceptance' },
                            { name: 'Sam Harris', role: 'Secular meditation advocacy' },
                            { name: 'Tara Brach', role: 'Western Buddhism teacher' }
                        ],
                        technologies: [
                            'Headspace app launch',
                            'Calm app growth',
                            'MBSR protocols standardized',
                            'Guided meditation audio'
                        ],
                        examples: [
                            { name: 'Headspace', description: 'Meditation app mainstream', url: 'https://www.headspace.com/' },
                            { name: 'Calm', description: 'Sleep and meditation', url: 'https://www.calm.com/' },
                            { name: '10% Happier', description: 'Skeptic-friendly meditation', url: 'https://www.tenpercent.com/' }
                        ]
                    },
                    2017: {
                        contributions: [
                            'Breathwork renaissance begins',
                            'VR meditation experiments',
                            'Mindfulness in education',
                            'Corporate wellness integration',
                            'Meditation research grows'
                        ],
                        keyPeople: [
                            { name: 'Wim Hof', role: 'Breathwork method popularization' },
                            { name: 'Sam Harris', role: 'Waking Up app launch' },
                            { name: 'Jack Kornfield', role: 'Online dharma teachings' }
                        ],
                        technologies: [
                            'Wim Hof Method protocols',
                            'Early VR meditation apps',
                            'Biometric meditation tracking',
                            'Group meditation platforms'
                        ],
                        examples: [
                            { name: 'Waking Up', description: 'Sam Harris meditation app', url: 'https://www.wakingup.com/' },
                            { name: 'Insight Timer', description: 'Free meditation community', url: 'https://insighttimer.com/' },
                            { name: 'Guided Meditation VR', description: 'VR contemplative spaces', url: 'https://guidedmeditationvr.com/' }
                        ]
                    },
                    2020: {
                        contributions: [
                            'Pandemic meditation boom',
                            'Breathwork as anxiety relief',
                            'VR meditation mainstream',
                            'Somatic practices integration',
                            'Trauma-informed mindfulness'
                        ],
                        keyPeople: [
                            { name: 'Wim Hof', role: 'Breathwork during pandemic' },
                            { name: 'Tara Brach', role: 'Online meditation surge' },
                            { name: 'Jon Kabat-Zinn', role: 'MBSR for pandemic stress' }
                        ],
                        technologies: [
                            'VR meditation platforms',
                            'Breathwork app integrations',
                            'Live-streamed meditation',
                            'Somatic tracking tools',
                            'Trauma-sensitive protocols'
                        ],
                        examples: [
                            { name: 'Calm VR', description: 'VR relaxation environments', url: 'https://www.calm.com/' },
                            { name: 'TRIPP', description: 'Psychedelic meditation VR', url: 'https://www.tripp.com/' },
                            { name: 'Othership', description: 'Breathwork community app', url: 'https://www.othership.us/' }
                        ]
                    },
                    2023: {
                        contributions: [
                            'AI-guided meditation',
                            'VR retreat experiences',
                            'Breathwork + biometrics',
                            'Psychedelic integration practices',
                            'Embodiment practices mainstream'
                        ],
                        keyPeople: [
                            { name: 'Sam Harris', role: 'AI meditation experiments' },
                            { name: 'Jack Kornfield', role: 'Psychedelic integration teacher' },
                            { name: 'Gabor Maté', role: 'Compassionate inquiry + psychedelics' }
                        ],
                        technologies: [
                            'AI personalized meditation',
                            'VR group meditation spaces',
                            'Real-time HRV feedback',
                            'Integration app platforms',
                            'Embodied meditation tracking'
                        ],
                        examples: [
                            { name: 'Headspace VR', description: 'Full VR meditation platform', url: 'https://www.headspace.com/' },
                            { name: 'TRIPP + Neurofeedback', description: 'Brain-guided meditation', url: 'https://www.tripp.com/' },
                            { name: 'Othership Breathwork', description: 'Community breathwork app', url: 'https://www.othership.us/' }
                        ]
                    }
                }
            },
            'gaming': {
                contentByYear: {
                    2015: {
                        contributions: [
                            'Indie games as art',
                            'Emotional storytelling',
                            'Minimalist game design',
                            'Flow state in gaming'
                        ],
                        keyPeople: [
                            { name: 'Jenova Chen', role: 'Journey success, thatgamecompany' },
                            { name: 'Jonathan Blow', role: 'The Witness creator' },
                            { name: 'Jane McGonigal', role: 'Games for positive impact' }
                        ],
                        technologies: [
                            'Unity engine accessibility',
                            'Procedural generation',
                            'Minimalist aesthetics',
                            'Emotional design patterns'
                        ],
                        examples: [
                            { name: 'Journey', description: 'Wordless emotional connection', url: 'https://thatgamecompany.com/journey/' },
                            { name: 'Monument Valley', description: 'Meditative puzzle game', url: 'https://www.monumentvalleygame.com/' },
                            { name: 'Flower', description: 'Relaxation through motion', url: 'https://thatgamecompany.com/flower/' }
                        ]
                    },
                    2017: {
                        contributions: [
                            'VR gaming emergence',
                            'Rhythm games renaissance',
                            'Wellness games category',
                            'Social VR experiences',
                            'Accessibility features grow'
                        ],
                        keyPeople: [
                            { name: 'Gabe Newell', role: 'VR gaming platform (Steam)' },
                            { name: 'Jenova Chen', role: 'Sky: Children of Light development' },
                            { name: 'Jane McGonigal', role: 'SuperBetter app' }
                        ],
                        technologies: [
                            'VR game engines',
                            'Haptic feedback controllers',
                            'Rhythm matching algorithms',
                            'Social presence systems',
                            'Accessibility options'
                        ],
                        examples: [
                            { name: 'Beat Saber', description: 'VR rhythm breakthrough', url: 'https://beatsaber.com/' },
                            { name: 'VRChat', description: 'Social VR platform', url: 'https://hello.vrchat.com/' },
                            { name: 'Superhot VR', description: 'Time-bending meditation', url: 'https://superhotvr.com/' }
                        ]
                    },
                    2020: {
                        contributions: [
                            'Pandemic gaming boom',
                            'VR fitness games',
                            'Meditation game genre',
                            'Flow state optimization',
                            'Wellness game design'
                        ],
                        keyPeople: [
                            { name: 'Jenova Chen', role: 'Sky: Children of Light live' },
                            { name: 'Jane McGonigal', role: 'Games for pandemic wellbeing' },
                            { name: 'Lucas Pope', role: 'Contemplative game design' }
                        ],
                        technologies: [
                            'VR fitness tracking',
                            'Adaptive difficulty AI',
                            'Biometric integration',
                            'Procedural relaxation',
                            'Social connection systems'
                        ],
                        examples: [
                            { name: 'Beat Saber', description: 'VR fitness phenomenon', url: 'https://beatsaber.com/' },
                            { name: 'Supernatural', description: 'VR fitness + meditation', url: 'https://www.meta.com/experiences/supernatural-unreal-fitness/1830168170427369/' },
                            { name: 'Sky: Children of Light', description: 'Social contemplative game', url: 'https://thatgamecompany.com/sky/' }
                        ]
                    },
                    2023: {
                        contributions: [
                            'AI-generated experiences',
                            'Therapeutic game design',
                            'Flow state biofeedback',
                            'VR meditation games',
                            'Wellness gaming mainstream'
                        ],
                        keyPeople: [
                            { name: 'Jenova Chen', role: 'Ongoing Sky expansions' },
                            { name: 'Jane McGonigal', role: 'Games + mental health research' },
                            { name: 'Sam Barlow', role: 'Narrative innovation' }
                        ],
                        technologies: [
                            'AI procedural generation',
                            'Real-time biofeedback',
                            'VR + neurofeedback',
                            'Therapeutic game mechanics',
                            'Adaptive wellness systems'
                        ],
                        examples: [
                            { name: 'Headspace VR', description: 'Meditation app Evolving to VR', url: 'https://www.headspace.com/xr' },
                            { name: 'TRIPP', description: 'Gamified meditation', url: 'https://www.tripp.com/' },
                            { name: 'Unpacking', description: 'Meditative narrative game', url: 'https://www.unpackinggame.com/' }
                        ]
                    }
                }
            },
            'digital-art': {
                contentByYear: {
                    2015: {
                        contributions: [
                            'Festival projection mapping',
                            'VJ culture evolution',
                            'Fractal art generation',
                            'Digital installations',
                            'Psychedelic visual art'
                        ],
                        keyPeople: [
                            { name: 'Android Jones', role: 'Festival visionary art' },
                            { name: 'Android Jones', role: 'Samskara VR development' },
                            { name: 'TeamLab', role: 'Interactive art installations' }
                        ],
                        technologies: [
                            'Projection mapping software',
                            'Real-time VJ systems',
                            'Fractal generation tools',
                            'Interactive installations',
                            'LED art technology'
                        ],
                        examples: [
                            { name: 'Android Jones Projections', description: 'Festival visionary art', url: 'https://androidjones.com/' },
                            { name: 'TeamLab Borderless', description: 'Interactive museum', url: 'https://www.teamlab.art/e/tokyo/' },
                            { name: 'Electric Forest Visuals', description: 'Immersive festivals', url: 'https://electricforestfestival.com/' }
                        ]
                    },
                    2016: {
                        contributions: [
                            'VR painting tools launch',
                            'Tilt Brush release',
                            'VR art galleries emerge',
                            '360° video art',
                            'Immersive storytelling'
                        ],
                        keyPeople: [
                            { name: 'Google Artists', role: 'Tilt Brush creators' },
                            { name: 'Android Jones', role: 'VR art pioneer (Samskara)' },
                            { name: 'Beeple', role: 'Daily digital art practice' }
                        ],
                        technologies: [
                            'Google Tilt Brush',
                            'VR sculpting tools',
                            '360° video cameras',
                            'Spatial audio for art',
                            'VR gallery platforms'
                        ],
                        examples: [
                            { name: 'Tilt Brush', description: 'VR painting revolution', url: 'https://store.steampowered.com/app/327140/Tilt_Brush' },
                            { name: 'Samskara VR', description: 'Android Jones psychedelic art', url: 'https://www.youtube.com/watch?v=tdIrQzlDAeI' },
                            { name: 'The Night Cafe VR', description: 'Van Gogh immersion', url: 'https://store.steampowered.com/app/482390/The_Night_Cafe_A_VR_Tribute_to_Vincent_Van_Gogh/' }
                        ]
                    },
                    2019: {
                        contributions: [
                            'VR art exhibitions',
                            'Projection mapping advances',
                            'Immersive theater',
                            'Interactive art experiences',
                            'Psychedelic art VR apps'
                        ],
                        keyPeople: [
                            { name: 'Android Jones', role: 'Microdose VR development' },
                            { name: 'Beeple', role: 'NFT art precursor work' },
                            { name: 'Refik Anadol', role: 'Data-driven installations' },
                            { name: 'TeamLab', role: 'Planets exhibition' }
                        ],
                        technologies: [
                            'VR art creation tools',
                            'Real-time ray tracing',
                            'Interactive projection',
                            'Spatial computing art',
                            'Multi-user VR galleries'
                        ],
                        examples: [
                            { name: 'Microdose VR', description: 'Psychedelic art therapy', url: 'https://microdosevr.com/' },
                            { name: 'The Under Presents', description: 'VR theater experience', url: 'https://www.tenderclaws.com/theunderpresents' },
                            { name: 'Tilt Brush Galleries', description: 'Virtual exhibitions', url: 'https://store.steampowered.com/app/327140/Tilt_Brush' }
                        ]
                    },
                    2022: {
                        contributions: [
                            'AI art generation boom',
                            'NFT art market',
                            'Generative art mainstream',
                            'VR art therapy',
                            'Immersive wellness art'
                        ],
                        keyPeople: [
                            { name: 'Beeple', role: 'NFT art phenomenon ($69M sale)' },
                            { name: 'Refik Anadol', role: 'AI + MoMA installation' },
                            { name: 'Android Jones', role: 'Ongoing VR art development' },
                            { name: 'TeamLab', role: 'Global immersive exhibitions' }
                        ],
                        technologies: [
                            'DALL-E, Midjourney, Stable Diffusion',
                            'Generative AI art tools',
                            'NFT platforms',
                            'VR art therapy protocols',
                            'Real-time AI rendering'
                        ],
                        examples: [
                            { name: 'Microdose VR', description: 'Therapeutic art standard', url: 'https://microdosevr.com/' },
                            { name: 'TRIPP Visual Art', description: 'Wellness-focused visuals', url: 'https://www.tripp.com/' },
                            { name: 'AI Art Exhibitions', description: 'Generative art galleries', url: 'https://www.teamlab.art/' }
                        ]
                    }
                }
            }
        },

        // Tutorial Steps Configuration
        tutorialSteps: [
            {
                id: 'welcome',
                title: 'Welcome to Cyberdelics',
                text: 'This visualization shows how 6 fields converged to create the cyberdelic discipline. Click Next to learn the basics.',
                target: null,
                position: 'center',
                spotlightShape: null
            },
            {
                id: 'domains',
                title: 'Explore the Domains',
                text: 'Click any glowing orb to fly in and see that field\'s contributions, key people, technologies, and examples. Drag to orbit the nebula. The examples link to real-world projects.',
                target: '.domain-node[data-id="psychedelic"] .node-circle',
                position: 'center',
                spotlightShape: 'circle',
                spotlightPadding: 10
            },
            {
                id: 'timeline',
                title: 'Travel Through Time',
                text: 'Use the timeline at the bottom to see how connections formed over the years. Drag the slider or press play.',
                target: '.cn3d-dock',
                position: 'center',
                spotlightShape: 'rect',
                spotlightPadding: 10
            }
        ]
    };

})();
