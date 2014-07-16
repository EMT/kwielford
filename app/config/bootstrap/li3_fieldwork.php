<?php


//  Set up Access rules

use li3_fieldwork\extensions\action\Controller;
use li3_fieldwork\access\Access;
use li3_fieldwork\email\Email;
use li3_fieldwork\extensions\helper\Share;

Controller::config([
    'whitelisted_formats' => ['json'],
    'non_secured_actions' => [
        '/slack.json'
    ]
]);

Access::setBehaviours(array(
    'default' => array(
        'authenticated' => function() {throw new \Exception('You don’t have access to this page.', 403); },
        'unauthenticated' => function() {
            header('Location: /login?auth_and_go_to=' . urlencode($_SERVER["REQUEST_URI"]), true, 302);
            exit();
        }
    )
));

Access::setRules([
    'is_super_admin' => ['sad' => true],
    'is_admin' => [
        'sad' => true,
        'adm' => true
    ],
    'is_owner' => [
        ['id' => ':user_id']
    ],
    'is_me' => [
        ['id' => ':id']
    ],
    'is_logged_in' => function($auth) {return ($auth); },
    'can_create_multiple_schools' => [
        'sad' => true,
        'adm' => true,
        'sof' => true
    ]
]);


Email::config([
    'mandrill_api_key' => 'zlVDcAzsFLbqFh0rnMzsQA',
    'from_name' => 'Big Street Survey',
    'from_email' => 'messages@madebyfieldwork.com',
    'template_dir' => __DIR__ . '/../../views/email/'
]);


Share::config([
    'fb_app_id' => '1419995714953382'
]);

?>