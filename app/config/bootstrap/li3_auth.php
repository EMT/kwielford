<?php

/**
 * Copy this config file to app/config/bootstrap
 * edit the configuration settings and inlude in
 * app/bootstrap.php
 */

use lithium\security\Password;
use lithium\security\Auth;
use lithium\net\http\Router;
use li3_auth\extensions\action\SessionsBaseController;
use li3_auth\extensions\data\UsersBase;



Auth::config([
    'default' => [
        'adapter' => 'Form',
        'model' => 'Users',
        'fields' => array('email', 'password'),
        'validators' => [
            'password' => function($form, $data) {
                return (trim($form)) && Password::check($form, $data);
            }
        ]
    ]
]);



SessionsBaseController::config([
    // Model to authenticate against
    'users_model' => 'app\models\Users',
    // Quick and dirty way to create an admin user for the application
    // This user is created and added to the database when login is attempted with these creds
    'super_admin' => [
        'email' => false, 
        'password' => 'something',
        // Add application specific fields
        'fname' => 'John',
        'lname' => 'Smith',
        'role' => 'sad',
        'terms' => 1,
        'verified' => 1
    ],
    // Allow persistent sessions
    'persistent_sessions' => true
]);

// UsersBase::config([
//     'redirects' => [
//         'UsersController::newVerifyEmail' => function($args) {
//             return Router::match(['Users::loginRedirect'] + $args);
//         }
//     ]
// ]);

?>