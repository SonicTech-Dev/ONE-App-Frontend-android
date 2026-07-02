// Put your INITIAL_DEVICE_CATEGORIES and LAN_HEADERS here
//Mockup Site Device ID and Category//
export const MOCKUP_1_DEVICE_CATEGORIES = [
      {
        category: 'Living Room',
        items: [
          
          { title: 'Hypanel Supreme', location: 'Reception', status: 'On', color: '#44ad57ff', isOn: false, iconName: 'smart-screen' ,library: 'MaterialIcons',
          lan: {
            device_id: 'd4f54a92bea2a440c8a6a23d0b636dcf7',
            ability_id: 'switch.0c110500755c_81_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd4f54a92bea2a440c8a6a23d0b636dcf7',
            ability_id: 'e35705591294a47fa93b0a2886c825599',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'Chandlier LivingRoom', location: 'Living Room', status: 'On', color: '#44ad57ff', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c110500755c_61_1',
            ability_id: 'switch.0c110500755c_61_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'dcd09f5b683d14ffc81dc141eb29153fe',
            ability_id: 'e5190ec1a96574f699f0b8985bfba3ce0',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'Curtain-LivingRoom', location: 'Living Room', status: 'Off', color: '#4ac0ff', isOn: false, iconName: 'curtains' , library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c110500755c_62_5',
            ability_id: 'cover.0c110500755c_62_5',
            commandPair: { on: 'turn_on', off: 'turn_off', stop: 'stop' }
          },
          wan: {
            device_id: 'd6be86b3b51204136b5b67f0f17b9771f',
            ability_id: 'e30a2ac11ebae42c6a5c898311a1dba34',
            commandPair: { on: 'open', off: 'close' , stop: 'stop' }
          }},
          { title: 'Door/Window Sensor LivingRoom', location: 'Living Room', status: 'Off', color: '#4ac0ff', isOn: false, iconName: 'door' , library: 'MaterialCommunityIcons',
          lan: {
            device_id: 'a9d66620505f5b1bc027d929fd301662',
            ability_id: 'binary_sensor.8a1e85371236826c0614e3ad8a287dd7',
            commandPair: { on: 'turn_on', off: 'turn_off', stop: 'stop' }
          },
          wan: {
            device_id: 'd38ba7b76db344356ba9180bc735d8020',
            ability_id: 'ea70b8f716cca427aa18496b63f89217b',
            commandPair: { on: 'open', off: 'close' , stop: 'stop' }
          }},
        ],
      },
      {
        category: 'Laundry Room',
        items: [
          { title: 'SpotLight Laundry', location: 'Laundry Room', status: 'On', color: '#7f8c8d', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c110500755c_73_1',
            ability_id: 'switch.0c110500755c_73_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'dc7ab296b43664b09a43e5e39680f3941',
            ability_id: 'e2308c5e1f9e2492883181a128938a49b',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
        ],
      },
      {
        category: 'Bedroom',
        items: [
          { title: 'Curtain-Bedroom', location: 'Bedroom', status: 'Off', color: '#4ac0ff', isOn: false, iconName: 'curtains' , library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052bf1cf_64_5',
            ability_id: 'cover.0c11052bf1cf_64_5',
            commandPair: { on: 'turn_on', off: 'turn_off', stop: 'stop' }
          },
          wan: {
            device_id: 'df3147f763bb3471c8453d1da62c61613',
            ability_id: 'e1636b619a61747f4a9b8b38ed939e8f8',
            commandPair: { on: 'open', off: 'close' , stop: 'stop' }
          }},
          
          { title: 'Hypanel Lux', location: 'Bedroom', status: 'Off', color: '#4ac0ff', isOn: false, iconName: 'smart-screen' , library: 'MaterialIcons',
          lan: {
            device_id: 'd1b001e5ddcf24d65a9d1c6ad23df43ba',
            ability_id: 'sensor.cf18328a17f44918aa6816f6c0a1ec3b',
            commandPair: { on: 'turn_on', off: 'turn_off', stop: 'stop' }
          },
          wan: {
            device_id: 'd1b001e5ddcf24d65a9d1c6ad23df43ba',
            ability_id: 'e2da086b780454a42ba2cbba0b5fe47dc',
            commandPair: { on: 'open', off: 'close' , stop: 'stop' }
          }},
          { title: 'Hypanel Keyplus', location: 'Bedroom', status: 'On', color: '#44ad57ff', isOn: false, iconName: 'smart-screen' ,library: 'MaterialIcons',
          lan: {
            device_id: 'de3ba9ed68dd84e6ba245ee97e09ccf65',
            ability_id: 'sensor.dee4257bdc6442aca774e117551bd9f8',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'de3ba9ed68dd84e6ba245ee97e09ccf65',
            ability_id: 'e1d07d9bd629642bcb4a1fab30c0f098a',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'SpotLight Bedroom Entrance', location: 'Bedroom', status: 'Off', color: '#ffbf42', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052bf1cf_66_1',
            ability_id: 'switch.0c11052bf1cf_66_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd6a31139f9f394772a598f5fb5c00fad7',
            ability_id: 'e5111101baa074943aa0b675b99de6e96',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'SpotLight Bedroom Bedside', location: 'Bedroom', status: 'Off', color: '#ffbf42', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052bf1cf_65_1',
            ability_id: 'switch.0c11052bf1cf_65_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'da8434565ba37471db2cc6ee2361654f2',
            ability_id: 'e23a24e76457246dcb23e3c16a2c57d46',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'Chandlier Bedroom', location: 'Bedroom', status: 'Off', color: '#ffbf42', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052bf1cf_61_1',
            ability_id: 'switch.0c11052bf1cf_61_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd48952ea7e63e4c869b072df6cb4a455e',
            ability_id: 'e76a555b39f8b4089b7dc2acf49f27ddc',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'Door/Window Sensor Bedroom', location: 'Bedroom', status: 'Off', color: '#ffbf42', isOn: false, iconName: 'door' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: 'f6458582925ab50d42ce075387eed019',
            ability_id: 'binary_sensor.86de5923d0953414a56d4ce6eea7a7be',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd7db00743bbb045ea9c23a3648b4a4d14',
            ability_id: 'e1dcf571d6136433da67f1112f7e93c82',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
        ],
      },
      {
        category: 'Bedroom Toilet',
        items: [
        { title: 'SpotLight Toilet', location: 'Bedroom Toilet', status: 'off', color: '#5d8185ff', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052bf1cf_63_1',
            ability_id: 'switch.0c11052bf1cf_63_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'de6a7f28750534aeb94dda098a5991857',
            ability_id: 'ea50b8ac58b3240f3bd2edf5f70b21c13',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
        ],
      },
      {
        category: 'Pouder Room',
        items: [
          { title: 'SpotLight Pouder Room', location: 'Pouder Room', status: 'off', color: '#ff00e6ff', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052bf1cf_62_1',
            ability_id: 'switch.0c11052bf1cf_62_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd9c52afe868ae4b37bfb726bc37893e7c',
            ability_id: 'e8b000d0f2d474ecdb5b4cbe5070854da',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
        ],
      },
      {
        category: 'Kitchen',
        items: [
          { title: 'Hypanel Keyplus Kitchen', location: 'Kitchen', status: 'On', color: '#8e44ad', isOn: false, iconName: 'smart-screen' ,library: 'MaterialIcons',
          lan: {
            device_id: 'daf64a922938248f1bdc723a12b94a6ea',
            ability_id: 'sensor.f4f0acdd6c60498a895044934084d5cc',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'daf64a922938248f1bdc723a12b94a6ea',
            ability_id: 'e1195767cbe3046069545bbf4254e221d',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'SpotLight Kitchen', location: 'Kitchen', status: 'On', color: '#8e44ad', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c110500755c_63_1',
            ability_id: 'switch.0c110500755c_63_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd00b9b20fc3e24c66987571aa45c553b9',
            ability_id: 'ed962f8674c764539ac11a8b42437b704',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'Flood Sensor Kitchen', location: 'Kitchen', status: 'On', color: '#8e44ad', isOn: false, iconName: 'water' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: 'b2cde7130cd1c35cbc2156651d2757ae',
            ability_id: 'binary_sensor.b9a5b821238f095d4ee0dca7595f7857',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'da7ac9c74feaf4719a4e1efb073031768',
            ability_id: 'e8996edcfea8c46609714a6fd457699f8',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
        ],
      },
      {
        category: 'Shared Toilet',
        items: [
          { title: 'SpotLight-1 SharedToilet', location: 'Shared Toilet', status: 'On', color: '#eeff00ff', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c110500755c_72_1',
            ability_id: 'switch.0c110500755c_72_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd6731699e0a6b4080ae305e6bd21bbe8a',
            ability_id: 'e71851be8b9e847bea043fc0013282925',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'SpotLight-2 SharedToilet', location: 'Shared Toilet', status: 'On', color: '#eeff00ff', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c110500755c_71_1',
            ability_id: 'switch.0c110500755c_71_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd51ebba95389047b389b40747f67afdbd',
            ability_id: 'e051015389e62487f92eab8c7d3732960',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
        ],
      },
      {
        category: 'Balcony',
        items: [
          { title: 'SpotLight Balcony', location: 'Balcony', status: 'On', color: '#00eeffff', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c110500755c_64_1',
            ability_id: 'switch.0c110500755c_64_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd8aa4242bc16840af920433704840b80c',
            ability_id: 'eef8730f28f884e3398262f2436399885',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          

        ],
      },
      {
        category: 'Entrance',
        items: [
          { title: 'AC', location: 'Entrance', status: 'off', color: '#ff0000ff', isOn: false, iconName: 'air-conditioner' , library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c110500755c_130_11',
            ability_id: 'climate.0c110500755c_130_11',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd7a5eac6564db4b33968830122b2818e3',
            ability_id: 'ebee0022cbed0457e8d746c48a2dd7205',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'SpotLight Entrance', location: 'Entrance', status: 'off', color: '#ff0000ff', isOn: false, iconName: 'lightbulb-on-outline' , library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c110500755c_65_1',
            ability_id: 'switch.0c110500755c_65_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'da5ba36fe8ebb470b8b4bba9ecee0ff19',
            ability_id: 'eaa82e4c013fe4ac6ab8c95bdfd08590c',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
        ],
      },  
];

//Mockup Kit 2 in sonic office for testing Device ID and category//

export const MOCKUP_2_DEVICE_CATEGORIES = [
      {
        category: 'Living Room',
        items: [
          
          { title: 'Hypanel Supreme', location: 'Reception', color: '#44ad57ff', isOn: false, iconName: 'smart-screen' ,library: 'MaterialIcons',
          lan: {
            device_id: 'd03852d726b074d77a7d658e7fac7d3b6',
            ability_id: 'sensor.f21e8b59430f47169d7f3bac8cf2ceca',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd03852d726b074d77a7d658e7fac7d3b6',
            ability_id: 'e7a908659c9e44327a8ad772a9f422d8c',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'Chandlier LivingRoom', location: 'Living Room', status: 'On', color: '#44ad57ff', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052bf195_61_1',
            ability_id: 'switch.0c11052bf195_61_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd03c4d30bc40a4a4a93d8b248a49d2818',
            ability_id: 'ecf00a15480654e84998a6055cbd8318a',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'Curtain-LivingRoom', location: 'Living Room', status: 'Off', color: '#4ac0ff', isOn: false, iconName: 'curtains' , library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052b761c_62_5',
            ability_id: 'cover.0c11052b761c_62_5',
            commandPair: { on: 'turn_on', off: 'turn_off', stop: 'stop' }
          },
          wan: {
            device_id: 'd467f8e96bd4f456eae181b4e073ec5c2',
            ability_id: 'e6f33169d71a4488fa916076e1f2fa9dd',
            commandPair: { on: 'open', off: 'close' , stop: 'stop' }
          }},
          { title: 'Door/Window Sensor LivingRoom', location: 'Living Room', color: '#4ac0ff', isOn: false, iconName: 'door' , library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0f15b4a26e78b6eb72281ad8d38a51e0',
            ability_id: 'binary_sensor.b676118620296fe6e5f6e55625fc04b8',
            commandPair: { on: 'turn_on', off: 'turn_off', stop: 'stop' }
          },
          wan: {
            device_id: 'd9f0054ffdb844d8f88f02c1cb09bec6a',
            ability_id: 'ed4512f04cfaf4111a16642305dcd9c5f',
            commandPair: { on: 'open', off: 'close' , stop: 'stop' }
          }},
        ],
      },
      {
        category: 'Laundry Room',
        items: [
          { title: 'SpotLight Laundry', location: 'Laundry Room', color: '#7f8c8d', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052bf195_62_1',
            ability_id: 'switch.0c11052bf195_62_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd49deec96abef4b4eb3f74d6539f122a4',
            ability_id: 'e6d0be147e860408a9a9c471223b07f0f',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
        ],
      },
      {
        category: 'Bedroom',
        items: [
          { title: 'Curtain-Bedroom', location: 'Bedroom', status: 'Off', color: '#4ac0ff', isOn: false, iconName: 'curtains' , library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052bf195_64_5',
            ability_id: 'cover.0c11052bf195_64_5',
            commandPair: { on: 'turn_on', off: 'turn_off', stop: 'stop' }
          },
          wan: {
            device_id: 'd5f0dadbe6df04e27a9a98ea7e4accbb1',
            ability_id: 'edd7b76f2ee57451b935df698a5455601',
            commandPair: { on: 'open', off: 'close' , stop: 'stop' }
          }},
          
          { title: 'Hypanel Lux', location: 'Bedroom', color: '#4ac0ff', isOn: false, iconName: 'smart-screen' , library: 'MaterialIcons',
          lan: {
            device_id: 'd394ddaa179d0469ebe4b7c710bfbe5e0',
            ability_id: 'sensor.38a2d1f5ca504d968e9a25aaf21d99be',
            commandPair: { on: 'turn_on', off: 'turn_off', stop: 'stop' }
          },
          wan: {
            device_id: 'd394ddaa179d0469ebe4b7c710bfbe5e0',
            ability_id: 'e35b9b80d8f6d4f36b4dad28607f60d69',
            commandPair: { on: 'open', off: 'close' , stop: 'stop' }
          }},
          { title: 'Hypanel Keyplus Bedside', location: 'Bedroom', color: '#44ad57ff', isOn: false, iconName: 'smart-screen' ,library: 'MaterialIcons',
          lan: {
            device_id: 'd6909df0aa38444ba8e11ce1f55e3cb9d',
            ability_id: 'sensor.1020d525ac56452ea1aa37b36006b374',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd6909df0aa38444ba8e11ce1f55e3cb9d',
            ability_id: 'e09c310b104bb449ca6c6544c2af2baee',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'SpotLight Bedroom Entrance', location: 'Bedroom', status: 'Off', color: '#ffbf42', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052bf195_66_1',
            ability_id: 'switch.0c11052bf195_66_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd0dc8bb4e9d4342df8b44bb6e71dba22e',
            ability_id: 'ea71c6f64aba94746929e5fafdae535da',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'SpotLight Bedroom Bedside', location: 'Bedroom', status: 'Off', color: '#ffbf42', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052bf195_65_1',
            ability_id: 'switch.0c11052bf195_65_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd5a2f33e07f6d4e77b624a977be836dfa',
            ability_id: 'eed0b49b2ddfb420eb3ea9cda53cb6669',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'Chandlier Bedroom', location: 'Bedroom', status: 'Off', color: '#ffbf42', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052b761c_61_1',
            ability_id: 'switch.0c11052b761c_61_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd8e2ae118be4c4dba8f41f2aaad1a0cce',
            ability_id: 'ef9c7d205c6994fe2abe9693b9b7d998a',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'Door/Window Sensor Bedroom', location: 'Bedroom', color: '#ffbf42', isOn: false, iconName: 'door' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '87b02f482a836a27eedc2c923f9fb25b',
            ability_id: 'binary_sensor.140af998a8a0b116ccf4c7a045970259',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'def01dc80dcae41aea36783678a0a3783',
            ability_id: 'ecb22df599c9a4175b26502257e97cca3',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
        ],
      },
      {
        category: 'Bedroom Toilet',
        items: [
        { title: 'SpotLight BedroomToilet', location: 'Bedroom Toilet', status: 'off', color: '#5d8185ff', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052bf195_63_1',
            ability_id: 'switch.0c11052bf195_63_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'da4faf1470c5c481a92e9e68995be5213',
            ability_id: 'e83378aab87da48f38a274a0d26e48f2c',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
        ],
      },
      {
        category: 'Pouder Room',
        items: [
          { title: 'SpotLight Pouder Room', location: 'Pouder Room', status: 'off', color: '#ff00e6ff', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052b761c_73_1',
            ability_id: 'switch.0c11052b761c_73_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd2d5164a2e04d4f01ab14c261fb73d04d',
            ability_id: 'e9fc349f737d5461a9cb618218a3cafd3',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
        ],
      },
      {
        category: 'Kitchen',
        items: [
          { title: 'Hypanel Keyplus Kitchen', location: 'Kitchen', color: '#8e44ad', isOn: false, iconName: 'smart-screen' ,library: 'MaterialIcons',
          lan: {
            device_id: 'd715ca4ce814c436ba3cb8a88702170c5',
            ability_id: 'sensor.3b92308744394573bc1bacb929ad779a',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd715ca4ce814c436ba3cb8a88702170c5',
            ability_id: 'e9be29437bf214e7bb393666819ee23ff',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'SpotLight Kitchen', location: 'Kitchen', status: 'On', color: '#8e44ad', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052b761c_63_1',
            ability_id: 'switch.0c11052b761c_63_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd10e5a65e1b214ceb8383039872776b31',
            ability_id: 'e8b8a2c5e26bc454e83577b90daca9ac7',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'Flood Sensor Kitchen', location: 'Kitchen', color: '#8e44ad', isOn: false, iconName: 'water' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0641c879eba8e9a9247d204c313b0660',
            ability_id: 'e088670036a8546c3b762eb8b117bbc3f',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'dde06e54e26fa4b44a78fa46d756845ad',
            ability_id: 'e674c572da9014e6ca81d367a4a95417c',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
        ],
      },
      {
        category: 'Shared Toilet',
        items: [
          { title: 'SpotLight-1 SharedToilet', location: 'Shared Toilet', status: 'On', color: '#eeff00ff', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052b761c_71_1',
            ability_id: 'switch.0c11052b761c_71_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'dc7edf1beadc246b0ab0248d73025d596',
            ability_id: 'e27f7bf610b324b5f9a842d35e83bc6d0',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'SpotLight-2 SharedToilet', location: 'Shared Toilet', status: 'On', color: '#eeff00ff', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052b761c_72_1',
            ability_id: 'switch.0c11052b761c_72_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd3ed95e7a4a29494791ef2c2cc3599615',
            ability_id: 'e8550a0fbbb2f4e64a3a9fc0e48be2c2a',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
        ],
      },
      {
        category: 'Balcony',
        items: [
          { title: 'SpotLight Balcony', location: 'Balcony', status: 'On', color: '#00eeffff', isOn: false, iconName: 'lightbulb-on-outline' ,library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052b761c_64_1',
            ability_id: 'switch.0c11052b761c_64_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd2de3fc641de34beeadbca68b6bf8209a',
            ability_id: 'ed80a8a5620da45f293da5c192d0cf06c',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
        ],
      },
      {
        category: 'Entrance',
        items: [
          { title: 'AC', location: 'Entrance', status: 'off', color: '#ff0000ff', isOn: false, iconName: 'air-conditioner' , library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052b761c_130_11',
            ability_id: 'climate.0c11052b761c_130_11',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'd3c434e4f847e4a26b29d7dd9b5ac2e56',
            ability_id: 'ed4530430e10e4f8abd0a009b0abd3116',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
          { title: 'SpotLight Entrance', location: 'Entrance', status: 'off', color: '#ff0000ff', isOn: false, iconName: 'lightbulb-on-outline' , library: 'MaterialCommunityIcons',
          lan: {
            device_id: '0c11052b761c_65_1',
            ability_id: 'switch.0c11052b761c_65_1',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          },
          wan: {
            device_id: 'da6cc81b55f49412e9374787402aab1ba',
            ability_id: 'e9b082875754c403a8934bbc37f3c9723',
            commandPair: { on: 'turn_on', off: 'turn_off' }
          }},
        ],
      },  
];

export const INITIAL_DEVICE_CATEGORIES = MOCKUP_2_DEVICE_CATEGORIES;

export const MOCKUP_OPTIONS = {
  MOCKUP_1: 'mockup1',
  MOCKUP_2: 'mockup2',
};

export const INTERCOM_DEVICE_CONFIG_BY_MOCKUP = {
  [MOCKUP_OPTIONS.MOCKUP_1]: {
    deviceId: '0C11052C6E92',
    lanRtspUrl: 'rtsp://admin:Sonic123@192.168.2.114:',
    wanRtspUrl: 'rtsp://user:J19IE753w25867v6@35.156.199.213:554/0C11052C6E92',
  },
  [MOCKUP_OPTIONS.MOCKUP_2]: {
    deviceId: '0C11052C6E79',
    lanRtspUrl: 'rtsp://admin:Sonic123@192.168.2.114:',
    wanRtspUrl: 'rtsp://user:nj1770Lx791a70r5@35.156.199.213:554/0C11052C6E79',
  },
};

export const getIntercomConfigByMockup = (selectedMockup = MOCKUP_OPTIONS.MOCKUP_2) => {
  return INTERCOM_DEVICE_CONFIG_BY_MOCKUP[selectedMockup] || INTERCOM_DEVICE_CONFIG_BY_MOCKUP[MOCKUP_OPTIONS.MOCKUP_2];
};

export const getDeviceCategoriesByMockup = (selectedMockup = MOCKUP_OPTIONS.MOCKUP_2) => {
  const source = selectedMockup === MOCKUP_OPTIONS.MOCKUP_1
    ? MOCKUP_1_DEVICE_CATEGORIES
    : MOCKUP_2_DEVICE_CATEGORIES;

  return source.map((category) => ({
    ...category,
    items: category.items.map((device) => ({ ...device })),
  }));
};