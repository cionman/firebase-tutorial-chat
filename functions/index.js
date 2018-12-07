const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();


exports.sendNotification = functions.database.ref('Messages/{roomId}/{messageId}').onCreate(event => {
    console.log('event.data: ', event.data);
    console.log('event.data.val() : ', event.data.val());

    const dataVal = event.data.val();
    if (!dataVal) {
        return console.log('Message data null! ');
    }

    const roomId = event.params.roomId; //이벤트가 발생한 방ID
    const sendMessageUserId = dataVal.uid; //메세지 발송자 ID
    const sendUserName = dataVal.userName; //메세지 발송자 이름
    const sendMsg = dataVal.message; //메세지
    const sendProfile = dataVal.profileImg ? dataVal.profileImg : ''; // 프로필 이미지
    const promiseRoomUserList = admin.database().ref(`RoomUsers/${roomId}`).once('value'); // 채팅방 유저리스트
    const promiseUsersConnection = admin.database().ref('UsersConnection').orderByChild('connection').equalTo(true).once('value'); // 접속자 데이터

    return Promise.all([promiseRoomUserList, promiseUsersConnection]).then(results => {
        const roomUsersSnapShot = results[0];
        const usersConnectionSnapShot = results[1];
        const arrRoomUserList =[];
        const arrConnectionUserList = [];

        if(roomUsersSnapShot.hasChildren()){
            roomUsersSnapShot.forEach(snapshot => {
                arrRoomUserList.push(snapshot.key);
            })
        }else{
            return console.log('RoomUserlist is null')
        }

        if(usersConnectionSnapShot.hasChildren()){
            usersConnectionSnapShot.forEach(snapshot => {
                const value  = snapshot.val();
                if(value){
                    arrConnectionUserList.push(snapshot.key);
                }
            })
        }else{
            return console.log('UserConnections Data가 없습니다');
        }

        const arrTargetUserList = arrRoomUserList.filter(item => {
            return arrConnectionUserList.indexOf(item) === -1;
        });


        console.log('arrTargetUserList : ',arrTargetUserList);
        const arrTargetUserListLength = arrTargetUserList.length;
        for(let i=0; i < arrTargetUserListLength; i++){
            console.log(`FcmId/${arrTargetUserList[i]}`);
            admin.database().ref(`FcmId/${arrTargetUserList[i]}`).once('value',fcmSnapshot => {
                console.log('FCM Token : ', fcmSnapshot.val());
                const token = fcmSnapshot.val();
                if(token){
                    const payload = {
                        notification: {
                            title: sendUserName,
                            body: sendMsg,
                            click_action :`http://fb-tutorial-chat.firebaseapp.com/?roomId=${roomId}`,
                            icon: sendProfile
                        }
                    };
                    admin.messaging().sendToDevice(token, payload).then(response => {
                        response.results.forEach((result, index) => {
                            const error = result.error;
                            if (error) {
                                console.error('FCM 실패 :', error.code);
                            }else{
                                console.log('FCM 성공');
                            }
                        });
                    });
                }

            });
        }

    });
});